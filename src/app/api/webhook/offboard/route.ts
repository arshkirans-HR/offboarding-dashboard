import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OFFBOARDING_TASK_TEMPLATES, isEmployeeInvolved, ExitType } from '@/lib/config';
import { sendOffboardingNotifications } from '@/lib/slack';

const SYNC_API_KEY = process.env.SYNC_API_KEY || '';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://offboarding-dashboard.vercel.app';

/**
 * POST /api/webhook/offboard
 *
 * Webhook endpoint for Slack Workflow Builder (or any external tool).
 * Accepts JSON with offboarding details and creates the full record + tasks.
 *
 * Auth: x-api-key header must match SYNC_API_KEY env var.
 *
 * Body (JSON):
 * {
 *   "full_name": "John Smith",
 *   "employee_email": "john@platinumlist.net",
 *   "department": "Sales",
 *   "job_title": "Sales Manager",          // optional
 *   "line_manager": "Paul Joseph",
 *   "line_manager_email": "paul@platinumlist.net",
 *   "last_working_day": "2026-06-15",
 *   "handover_receiver": "Jane Doe",       // optional
 *   "exit_type": "Resignation"             // optional, defaults to Resignation
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const apiKey = request.headers.get('x-api-key') || '';
    if (!SYNC_API_KEY || apiKey !== SYNC_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Extract and validate fields
    const fullName = body.full_name?.trim() || '';
    const employeeEmail = body.employee_email?.trim() || '';
    const department = body.department?.trim() || '';
    const jobTitle = body.job_title?.trim() || '';
    const lineManager = body.line_manager?.trim() || '';
    const lineManagerEmail = body.line_manager_email?.trim() || '';
    const lastWorkingDay = body.last_working_day?.trim() || '';
    const handoverReceiver = body.handover_receiver?.trim() || '';
    const exitType = (body.exit_type?.trim() || 'Resignation') as ExitType;

    // Validate required fields
    const missing: string[] = [];
    if (!fullName) missing.push('full_name');
    if (!employeeEmail) missing.push('employee_email');
    if (!lineManager) missing.push('line_manager');
    if (!lineManagerEmail) missing.push('line_manager_email');
    if (!lastWorkingDay) missing.push('last_working_day');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missing },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('offboarding_employees')
      .select('id')
      .ilike('employee_email', employeeEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `${fullName} already has an active offboarding record.`, employee_id: existing.id },
        { status: 409 }
      );
    }

    // Get next request number
    const { data: maxReq } = await supabase
      .from('offboarding_employees')
      .select('request_number')
      .order('request_number', { ascending: false })
      .limit(1)
      .single();
    const nextRequestNum = (maxReq?.request_number || 0) + 1;

    // Compute status
    const lwd = new Date(lastWorkingDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lwd.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((lwd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const overallStatus = daysUntil > 14 ? 'Upcoming' : 'In Progress';

    const employeeInvolved = isEmployeeInvolved(exitType);

    // Create employee record
    const { data: employee, error: empError } = await supabase
      .from('offboarding_employees')
      .insert({
        request_number: nextRequestNum,
        timestamp: new Date().toISOString(),
        full_name: fullName,
        employee_email: employeeEmail,
        department: department || null,
        job_title: jobTitle || null,
        line_manager: lineManager,
        line_manager_email: lineManagerEmail,
        last_working_day: lastWorkingDay,
        handover_receiver: handoverReceiver || null,
        exit_type: exitType,
        exit_form_status: 'Not Filled',
        overall_status: overallStatus,
      })
      .select('id')
      .single();

    if (empError || !employee) {
      console.error('Webhook: Error creating employee:', empError);
      return NextResponse.json(
        { error: 'Failed to create record', details: empError?.message },
        { status: 500 }
      );
    }

    // Generate tasks
    const tasks = OFFBOARDING_TASK_TEMPLATES.map((template) => {
      let dueDate: string | null = null;
      if (lastWorkingDay) {
        const lwdDate = new Date(lastWorkingDay);
        const due = new Date(lwdDate);
        due.setDate(due.getDate() + template.days_offset);
        dueDate = due.toISOString().split('T')[0];
      }

      const isEmployeeTask = template.task_category === 'Employee';
      const status = (!employeeInvolved && isEmployeeTask) ? 'Skipped' : 'Pending';

      return {
        employee_id: employee.id,
        task_name: template.task_name,
        task_category: template.task_category,
        task_stage: template.task_stage,
        status,
        due_date: dueDate,
        sort_order: template.sort_order,
      };
    });

    const { error: taskError } = await supabase.from('offboarding_tasks').insert(tasks);
    if (taskError) {
      console.error('Webhook: Error generating tasks:', taskError);
    }

    // Send Slack notifications
    const slackResult = await sendOffboardingNotifications({
      employeeName: fullName,
      employeeEmail,
      managerName: lineManager,
      managerEmail: lineManagerEmail,
      department: department || 'Unknown',
      lastWorkingDay,
      employeeId: employee.id,
      exitType,
      notifyEmployee: employeeInvolved,
    });

    const dashboardLink = `${DASHBOARD_URL}/employee/${employee.id}`;
    const activeTasks = tasks.filter(t => t.status === 'Pending').length;
    const skippedTasks = tasks.filter(t => t.status === 'Skipped').length;

    return NextResponse.json({
      success: true,
      employee_id: employee.id,
      request_number: nextRequestNum,
      exit_type: exitType,
      active_tasks: activeTasks,
      skipped_tasks: skippedTasks,
      employee_notified: slackResult.employeeNotified,
      manager_notified: slackResult.managerNotified,
      dashboard_link: dashboardLink,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
