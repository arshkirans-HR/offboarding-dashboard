/**
 * Slack notification helper for offboarding events.
 * Requires SLACK_BOT_TOKEN env var (xoxb-...) with chat:write + users:read.email scopes.
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const OFFBOARDING_HR_CHANNEL = process.env.SLACK_HR_CHANNEL || 'C07NPCXR6PP'; // #offboarding-hr
const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://offboarding-dashboard.vercel.app';

interface SlackNotifyPayload {
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  managerEmail: string;
  department: string;
  lastWorkingDay: string;
  employeeId: string; // Supabase record ID for dashboard link
  exitType?: string;
  notifyEmployee?: boolean; // false for "Termination without notice"
}

/**
 * Look up a Slack user ID by their email address
 */
async function findSlackUserByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN || !email) return null;

  try {
    const res = await fetch('https://slack.com/api/users.lookupByEmail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(email)}`,
    });

    const data = await res.json();
    if (data.ok && data.user) {
      return data.user.id;
    }
    console.log(`Slack user not found for ${email}:`, data.error);
    return null;
  } catch (err) {
    console.error('Error looking up Slack user:', err);
    return null;
  }
}

/**
 * Send a Slack message (DM or channel)
 */
async function sendSlackMessage(channel: string, text: string, blocks?: object[]): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.log('SLACK_BOT_TOKEN not set, skipping notification');
    return false;
  }

  try {
    const body: Record<string, unknown> = { channel, text };
    if (blocks) body.blocks = blocks;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack send failed:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error sending Slack message:', err);
    return false;
  }
}

/**
 * Send all offboarding notifications:
 * 1. DM to employee with their task link
 * 2. DM to manager with their task link
 * 3. Message to #offboarding-hr channel
 */
export async function sendOffboardingNotifications(payload: SlackNotifyPayload): Promise<{
  employeeNotified: boolean;
  managerNotified: boolean;
  hrNotified: boolean;
}> {
  const result = { employeeNotified: false, managerNotified: false, hrNotified: false };
  const dashboardLink = `${DASHBOARD_URL}/employee/${payload.employeeId}`;
  const shouldNotifyEmployee = payload.notifyEmployee !== false;

  // 1. Notify Employee (skip for "Termination without notice")
  if (shouldNotifyEmployee) {
    const employeeSlackId = await findSlackUserByEmail(payload.employeeEmail);
    if (employeeSlackId) {
      result.employeeNotified = await sendSlackMessage(
        employeeSlackId,
        `Hi ${payload.employeeName}, your offboarding process has been initiated. Please review and complete your tasks.`,
        [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Your Offboarding Has Started', emoji: true }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hi *${payload.employeeName}*,\n\nYour offboarding process has been initiated. Your last working day is *${payload.lastWorkingDay}*.\n\nPlease review and complete your assigned tasks on the dashboard.`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View My Tasks', emoji: true },
                url: dashboardLink,
                style: 'primary'
              }
            ]
          }
        ]
      );
    }
  }

  // 2. Notify Manager
  const managerSlackId = await findSlackUserByEmail(payload.managerEmail);
  if (managerSlackId) {
    result.managerNotified = await sendSlackMessage(
      managerSlackId,
      `Offboarding initiated for ${payload.employeeName} (${payload.department}). Please review your manager tasks.`,
      [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Offboarding Started - Action Required', emoji: true }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${payload.employeeName}* (${payload.department} - ${payload.managerName}'s team) has started offboarding.\n\n*Last Working Day:* ${payload.lastWorkingDay}\n\nYou have manager tasks to complete. You can also monitor ${payload.employeeName}'s progress.`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Tasks', emoji: true },
              url: dashboardLink,
              style: 'primary'
            }
          ]
        }
      ]
    );
  }

  // 3. Notify HR Channel
  result.hrNotified = await sendSlackMessage(
    OFFBOARDING_HR_CHANNEL,
    `New offboarding: ${payload.employeeName} (${payload.department}). Last day: ${payload.lastWorkingDay}`,
    [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'New Offboarding Initiated', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Employee:*\n${payload.employeeName}` },
          { type: 'mrkdwn', text: `*Department:*\n${payload.department}` },
          { type: 'mrkdwn', text: `*Exit Type:*\n${payload.exitType || 'Resignation'}` },
          { type: 'mrkdwn', text: `*Manager:*\n${payload.managerName}` },
          { type: 'mrkdwn', text: `*Last Working Day:*\n${payload.lastWorkingDay}` },
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Employee notified: ${shouldNotifyEmployee ? (result.employeeNotified ? 'Yes' : 'No (email not in Slack)') : 'No (not applicable for this exit type)'}\nManager notified: ${managerSlackId ? 'Yes' : 'No (email not in Slack)'}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Dashboard', emoji: true },
            url: dashboardLink,
            style: 'primary'
          }
        ]
      }
    ]
  );

  return result;
}
