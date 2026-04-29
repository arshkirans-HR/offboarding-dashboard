import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OFFBOARDING_TASK_TEMPLATES } from '@/lib/config';
import { sendOffboardingNotifications } from '@/lib/slack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Shared secret to verify requests come from Google Apps Script
const WEBHOOK_SECRET = process.env.OFFBOARD_WEBHOOK_SECRET || '';

/**
 * POST /api/offboard
 *
 * Called by Google Apps Script when the offboarding form is submitted.
 * Creates the employee record, generates all tasks, and sends Slack notifications.
 *
 * Expected JSON body:
 * {
 *   secret: string,              // must match OFFBOARD_WEBHOOK_SECRET
 *   full_name: string,
 *   employee_email: string,
 *   department: string,
 *   job_title: string,
 *   line_manager: string,
 *   line_manager_email: string,
 *   last_working_day: string,     // YYYY-MM-DD
 *   handover_details?: string,
 *   handover_receiver?: string,
 *   laptop_status?: string,
 *   mobile_status?: string,
 *   other_equipment?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook secret (skip if not configured yet for testing)
    if (WEBHOOK_SECRET && body.secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    const { full_name, employee_email, department, line_manager, line_manager_email, last_working_day } = body;

    if (!full_name || !last_working_day) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, last_working_day' },
        { status: 400 }
      );
    }

    // Check if employee already exists (by email or name)
    let existingId: string | null = null;
    if (employee_email) {
      const { data: byEmail } = await supabase
        .from('offboarding_employees')
        .select('id')
        .ilike('employee_email', employee_email)
        .maybeSingle();
      if (byEmail) existingId = byEmail.id;
    }
    if (!existingId) {
      const { data: byName } = await supabase
        .from('offboarding_employees')
        .select('id')
        .eq('full_name', full_name)
        .maybeSingle();
      if (byName) existingId = byName.id;
    }

    if (existingId) {
      return NextResponse.json(
        { error: 'Employee already has an offboarding record', employee_id: existingId },
        { status: 409 }
      );
    }

    // Determine the next request number
    const { data: maxReq } = await supabase
      .from('offboarding_employees')
      .select('request_number')
      .order('request_number', { ascending: false })
      .limit(1)
      .single();
    const nextRequestNum = (maxReq?.request_number || 0) + 1;

    // Compute overall status
    const lwd = new Date(last_working_day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lwd.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((lwd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const overallStatus = daysUntil > 14 ? 'Upcoming' : 'In Progress';

    // Create employee record
    const { data: employee, error: empError } = await supabase
      .from('offboarding_employees')
      .insert({
        request_number: nextRequestNum,
        timestamp: new Date().toISOString(),
        full_name,
        employee_email: employee_email || null,
        department: department || null,
        job_title: body.job_title || null,
        line_manager: line_manager || null,
        line_manager_email: line_manager_email || null,
        last_working_day,
        handover_details: body.handover_details || null,
        handover_receiver: body.handover_receiver || null,
        laptop_status: body.laptop_status || null,
        mobile_status: body.mobile_status || null,
        other_equipment: body.other_equipment || null,
        exit_form_status: 'Not Filled',
        overall_status: overallStatus,
      })
      .select('id')
      .single();

    if (empError || !employee) {
      console.error('Error creating employee:', empError);
      return NextResponse.json({ error: 'Failed to create employee record' }, { status: 500 });
    }

    // Generate tasks with task_stage
    const tasks = OFFBOARDING_TASK_TEMPLATES.map((template) => {
      let dueDate: string | null = null;
      if (last_working_day) {
        const lwdDate = new Date(last_working_day);
        const due = new Date(lwdDate);
        due.setDate(due.getDate() + template.days_offset);
        dueDate = due.toISOString().split('T')[0];
      }

      return {
        employee_id: employee.id,
        task_name: template.task_name,
        task_category: template.task_category,
        task_stage: template.task_stage,
        status: 'Pending',
        due_date: dueDate,
        sort_order: template.sort_order,
      };
    });

    const { error: taskError } = await supabase.from('offboarding_tasks').insert(tasks);
    if (taskError) {
      console.error('Error generating tasks:', taskError);
    }

    // Send Slack notifications (non-blocking - don't fail the request if Slack fails)
    let slackResult = { employeeNotified: false, managerNotified: false, hrNotified: false };
    try {
      slackResult = await sendOffboardingNotifications({
        employeeName: full_name,
        employeeEmail: employee_email || '',
        managerName: line_manager || '',
        managerEmail: line_manager_email || '',
        department: department || 'Unknown',
        lastWorkingDay: last_working_day,
        employeeId: employee.id,
      });
    } catch (slackErr) {
      console.error('Slack notification error (non-fatal):', slackErr);
    }

    return NextResponse.json({
      success: true,
      employee_id: employee.id,
      request_number: nextRequestNum,
      tasks_created: tasks.length,
      notifications: slackResult,
      dashboard_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://offboarding-dashboard.vercel.app'}/employee/${employee.id}`,
    });
  } catch (error) {
    console.error('Offboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/offboard',
    method: 'POST',
    description: 'Webhook to create a new offboarding. Send JSON with: full_name, employee_email, department, line_manager, line_manager_email, last_working_day',
  });
}
