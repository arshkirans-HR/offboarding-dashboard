import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OFFBOARDING_TASK_TEMPLATES } from '@/lib/config';
import { sendOffboardingNotifications } from '@/lib/slack';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://offboarding-dashboard.vercel.app';

/**
 * POST /api/slack/interact
 *
 * Handles Slack interactive payloads (modal submissions).
 * When HR submits the offboarding form modal, this:
 * 1. Creates the employee record in Supabase
 * 2. Generates all 33 offboarding tasks
 * 3. Sends Slack DMs to employee + manager
 * 4. Posts confirmation to #offboarding-hr
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadStr = formData.get('payload') as string;

    if (!payloadStr) {
      return new NextResponse('Missing payload', { status: 400 });
    }

    const payload = JSON.parse(payloadStr);

    // Only handle modal submissions for our callback
    if (payload.type !== 'view_submission' || payload.view?.callback_id !== 'offboard_submit') {
      return NextResponse.json({ response_action: 'clear' });
    }

    const values = payload.view.state.values;
    const metadata = JSON.parse(payload.view.private_metadata || '{}');

    // Extract form values
    const fullName = values.full_name?.value?.value || '';
    const employeeEmail = values.employee_email?.value?.value || '';
    const department = values.department?.value?.selected_option?.value || '';
    const jobTitle = values.job_title?.value?.value || '';
    const lineManager = values.line_manager?.value?.value || '';
    const lineManagerEmail = values.line_manager_email?.value?.value || '';
    const lastWorkingDay = values.last_working_day?.value?.selected_date || '';
    const handoverReceiver = values.handover_receiver?.value?.value || '';

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!fullName) errors.full_name = 'Employee name is required';
    if (!employeeEmail) errors.employee_email = 'Employee email is required';
    if (!lastWorkingDay) errors.last_working_day = 'Last working day is required';
    if (!lineManager) errors.line_manager = 'Line manager is required';
    if (!lineManagerEmail) errors.line_manager_email = 'Line manager email is required';

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({
        response_action: 'errors',
        errors,
      });
    }

    // Check if employee already exists
    const { data: existing } = await supabase
      .from('offboarding_employees')
      .select('id')
      .ilike('employee_email', employeeEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        response_action: 'errors',
        errors: {
          employee_email: `${fullName} already has an active offboarding record.`,
        },
      });
    }

    // Process offboarding synchronously â Vercel kills the function after
    // the response is sent, so background promises never complete.
    // Slack allows up to 3 seconds for modal responses; processOffboarding
    // typically finishes well within that window.
    try {
      await processOffboarding({
        fullName,
        employeeEmail,
        department,
        jobTitle,
        lineManager,
        lineManagerEmail,
        lastWorkingDay,
        handoverReceiver,
        triggeredBy: metadata.triggered_by || payload.user?.id || '',
      });
    } catch (err) {
      console.error('Offboarding processing error:', err);
    }

    // Clear the modal
    return NextResponse.json({ response_action: 'clear' });
  } catch (error) {
    console.error('Interact handler error:', error);
    return NextResponse.json({ response_action: 'clear' });
  }
}

async function processOffboarding(data: {
  fullName: string;
  employeeEmail: string;
  department: string;
  jobTitle: string;
  lineManager: string;
  lineManagerEmail: string;
  lastWorkingDay: string;
  handoverReceiver: string;
  triggeredBy: string;
}) {
  try {
    // Get next request number
    const { data: maxReq } = await supabase
      .from('offboarding_employees')
      .select('request_number')
      .order('request_number', { ascending: false })
      .limit(1)
      .single();
    const nextRequestNum = (maxReq?.request_number || 0) + 1;

    // Compute status
    const lwd = new Date(data.lastWorkingDay);
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
        full_name: data.fullName,
        employee_email: data.employeeEmail,
        department: data.department || null,
        job_title: data.jobTitle || null,
        line_manager: data.lineManager,
        line_manager_email: data.lineManagerEmail,
        last_working_day: data.lastWorkingDay,
        handover_receiver: data.handoverReceiver || null,
        exit_form_status: 'Not Filled',
        overall_status: overallStatus,
      })
      .select('id')
      .single();

    if (empError || !employee) {
      console.error('Error creating employee:', empError);
      await sendSlackDM(data.triggeredBy, `Failed to create offboarding for ${data.fullName}. Error: ${empError?.message}`);
      return;
    }

    // Generate tasks
    const tasks = OFFBOARDING_TASK_TEMPLATES.map((template) => {
      let dueDate: string | null = null;
      if (data.lastWorkingDay) {
        const lwdDate = new Date(data.lastWorkingDay);
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

    // Send Slack notifications to employee, manager, and HR channel
    const slackResult = await sendOffboardingNotifications({
      employeeName: data.fullName,
      employeeEmail: data.employeeEmail,
      managerName: data.lineManager,
      managerEmail: data.lineManagerEmail,
      department: data.department || 'Unknown',
      lastWorkingDay: data.lastWorkingDay,
      employeeId: employee.id,
    });

    // Send confirmation DM to the HR person who triggered the command
    const dashboardLink = `${DASHBOARD_URL}/employee/${employee.id}`;
    await sendSlackDM(
      data.triggeredBy,
      `Offboarding started for *${data.fullName}* (${data.department}).\n\n` +
      `*Last Working Day:* ${data.lastWorkingDay}\n` +
      `*Tasks created:* ${tasks.length}\n` +
      `*Employee notified:* ${slackResult.employeeNotified ? 'Yes' : 'No'}\n` +
      `*Manager notified:* ${slackResult.managerNotified ? 'Yes' : 'No'}\n\n` +
      `<${dashboardLink}|View in Dashboard>`
    );
  } catch (err) {
    console.error('processOffboarding error:', err);
    await sendSlackDM(data.triggeredBy, `Something went wrong creating the offboarding for ${data.fullName}. Please check the dashboard.`);
  }
}

async function sendSlackDM(userId: string, text: string) {
  if (!SLACK_BOT_TOKEN || !userId) return;

  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: userId, text }),
    });
  } catch (err) {
    console.error('Failed to send DM:', err);
  }
}
