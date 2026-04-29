/**
 * Google Apps Script - Offboarding Form Webhook
 *
 * HOW TO INSTALL:
 * 1. Open your Google Form in edit mode
 * 2. Click the 3 dots menu > Script editor
 * 3. Delete everything and paste this entire script
 * 4. Update WEBHOOK_URL and WEBHOOK_SECRET below
 * 5. Click Run > onFormSubmit (to authorize the script)
 * 6. Go to Triggers (clock icon on left) > Add Trigger:
 *    - Function: onFormSubmit
 *    - Event source: From form
 *    - Event type: On form submit
 * 7. Save
 *
 * FORM FIELD MAPPING:
 * Update the field names below to match your Google Form questions exactly.
 */

// === CONFIGURATION ===
const WEBHOOK_URL = 'https://offboarding-dashboard.vercel.app/api/offboard';
const WEBHOOK_SECRET = ''; // Set this to match OFFBOARD_WEBHOOK_SECRET in Vercel env vars

// Map your Google Form question titles to the API fields
// Update these strings to match your exact form question titles
const FIELD_MAP = {
  full_name: 'Full Name',
  employee_email: 'Email Address',     // or 'Employee Email'
  department: 'Department',
  job_title: 'Job Title',
  line_manager: 'Line Manager',
  line_manager_email: 'Line Manager Email',
  last_working_day: 'Last Working Day',
  handover_details: 'Handover Details',
  handover_receiver: 'Handover Receiver',
  laptop_status: 'Laptop / Computer',
  mobile_status: 'Mobile Phone',
  other_equipment: 'Other Equipment',
};

// === MAIN FUNCTION ===
function onFormSubmit(e) {
  try {
    const responses = e.response.getItemResponses();
    const data = { secret: WEBHOOK_SECRET };

    // Extract form responses by matching question titles
    for (const item of responses) {
      const title = item.getItem().getTitle().trim();
      const value = item.getResponse();

      for (const [apiField, formTitle] of Object.entries(FIELD_MAP)) {
        if (title.toLowerCase() === formTitle.toLowerCase()) {
          data[apiField] = value;
          break;
        }
      }
    }

    // Also capture the respondent's email if form collects it
    const respondentEmail = e.response.getRespondentEmail();
    if (respondentEmail && !data.employee_email) {
      data.employee_email = respondentEmail;
    }

    // Format the date to YYYY-MM-DD if present
    if (data.last_working_day) {
      const dateStr = data.last_working_day;
      // Try to parse various date formats
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        data.last_working_day = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
    }

    Logger.log('Sending offboarding data: ' + JSON.stringify(data));

    // Send to the dashboard API
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log('Webhook response (' + responseCode + '): ' + responseBody);

    if (responseCode === 200 || responseCode === 201) {
      Logger.log('Offboarding created successfully!');
    } else if (responseCode === 409) {
      Logger.log('Employee already has an offboarding record');
    } else {
      Logger.log('Webhook failed with status ' + responseCode);
      // Send email alert to HR on failure
      MailApp.sendEmail(
        'hr@platinumlist.net',
        'Offboarding Webhook Failed',
        'The offboarding webhook failed for: ' + (data.full_name || 'Unknown') +
        '\nStatus: ' + responseCode +
        '\nResponse: ' + responseBody +
        '\n\nPlease create the offboarding manually in the dashboard.'
      );
    }
  } catch (error) {
    Logger.log('Error in onFormSubmit: ' + error.toString());
    // Send email alert on error
    MailApp.sendEmail(
      'hr@platinumlist.net',
      'Offboarding Script Error',
      'Error processing offboarding form submission: ' + error.toString()
    );
  }
}

// === TEST FUNCTION ===
// Use this to test the webhook without submitting the form
function testWebhook() {
  const testData = {
    secret: WEBHOOK_SECRET,
    full_name: 'Test Employee',
    employee_email: 'test@platinumlist.net',
    department: 'Sales',
    job_title: 'Sales Associate',
    line_manager: 'Test Manager',
    line_manager_email: 'manager@platinumlist.net',
    last_working_day: '2026-06-15',
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(testData),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}
