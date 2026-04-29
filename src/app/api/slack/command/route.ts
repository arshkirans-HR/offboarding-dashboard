import { NextRequest, NextResponse } from 'next/server';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

/**
 * POST /api/slack/command
 *
 * Handles the /offboard slash command from Slack.
 * Opens a modal form for HR to fill in the departing employee's details.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const triggerId = formData.get('trigger_id') as string;
    const userId = formData.get('user_id') as string;
    const command = formData.get('command') as string;

    if (!triggerId) {
      return new NextResponse('Missing trigger_id', { status: 400 });
    }

    // Open a modal with the offboarding form
    const modal = {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'offboard_submit',
        title: {
          type: 'plain_text',
          text: 'Start Offboarding',
        },
        submit: {
          type: 'plain_text',
          text: 'Start Offboarding',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        blocks: [
          {
            type: 'input',
            block_id: 'full_name',
            label: { type: 'plain_text', text: 'Employee Full Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'e.g. John Smith' },
            },
          },
          {
            type: 'input',
            block_id: 'employee_email',
            label: { type: 'plain_text', text: 'Employee Email' },
            element: {
              type: 'email_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'e.g. john.smith@platinumlist.net' },
            },
          },
          {
            type: 'input',
            block_id: 'department',
            label: { type: 'plain_text', text: 'Department' },
            element: {
              type: 'static_select',
              action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Sales' }, value: 'Sales' },
                { text: { type: 'plain_text', text: 'Product' }, value: 'Product' },
                { text: { type: 'plain_text', text: 'Marketing' }, value: 'Marketing' },
                { text: { type: 'plain_text', text: 'HR' }, value: 'HR' },
                { text: { type: 'plain_text', text: 'Attractions' }, value: 'Attractions' },
                { text: { type: 'plain_text', text: 'Operations' }, value: 'Operations' },
                { text: { type: 'plain_text', text: 'Finance' }, value: 'Finance' },
                { text: { type: 'plain_text', text: 'Customer Support' }, value: 'Customer Support' },
                { text: { type: 'plain_text', text: 'Development' }, value: 'Development' },
                { text: { type: 'plain_text', text: 'Business Events' }, value: 'Business Events' },
                { text: { type: 'plain_text', text: 'Analytics' }, value: 'Analytics' },
                { text: { type: 'plain_text', text: 'Design' }, value: 'Design' },
              ],
            },
          },
          {
            type: 'input',
            block_id: 'job_title',
            label: { type: 'plain_text', text: 'Job Title' },
            element: {
              type: 'plain_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'e.g. Sales Manager' },
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'line_manager',
            label: { type: 'plain_text', text: 'Line Manager Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'e.g. Paul Joseph' },
            },
          },
          {
            type: 'input',
            block_id: 'line_manager_email',
            label: { type: 'plain_text', text: 'Line Manager Email' },
            element: {
              type: 'email_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'e.g. paul.joseph@platinumlist.net' },
            },
          },
          {
            type: 'input',
            block_id: 'last_working_day',
            label: { type: 'plain_text', text: 'Last Working Day' },
            element: {
              type: 'datepicker',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Select date' },
            },
          },
          {
            type: 'input',
            block_id: 'handover_receiver',
            label: { type: 'plain_text', text: 'Handover Receiver' },
            element: {
              type: 'plain_text_input',
              action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Who will receive the handover?' },
            },
            optional: true,
          },
        ],
        // Store the HR user who triggered the command
        private_metadata: JSON.stringify({ triggered_by: userId }),
      },
    };

    const res = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modal),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('Failed to open modal:', data.error);
      return new NextResponse(
        `Sorry, I couldn't open the offboarding form. Error: ${data.error}`,
        { status: 200 }
      );
    }

    // Return empty 200 to acknowledge the slash command (Slack requires this within 3s)
    return new NextResponse('', { status: 200 });
  } catch (error) {
    console.error('Slash command error:', error);
    return new NextResponse('Something went wrong. Please try again.', { status: 200 });
  }
}
