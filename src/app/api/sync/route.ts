import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OFFBOARDING_TASK_TEMPLATES } from '@/lib/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyWCwOXgS5BBrUBmIo0Mx5sidGQYZO91dkVe_F2MG_m5dEAm8yyLtaT_PKM0Vu76489PQ/exec';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    if (row.some((c) => c)) rows.push(row);
  }
  return rows;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try M/D/YYYY format first (from Google Sheets)
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try ISO format
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

function computeOverallStatus(lastWorkingDay: string | null): string {
  if (!lastWorkingDay) return 'In Progress';
  const lwd = new Date(lastWorkingDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lwd.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((lwd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil > 14) return 'Upcoming';
  return 'In Progress';
}

export async function POST() {
  try {
    // Fetch CSV from Google Apps Script proxy (keeps sheet private)
    const csvUrl = `${APPS_SCRIPT_URL}?format=csv`;
    const response = await fetch(csvUrl, { redirect: 'follow' });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch Google Sheet via Apps Script' }, { status: 500 });
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
    }

    // Column mapping (0-indexed from the CSV headers):
    // 0: Timestamp
    // 1: Your Full Name
    // 2: Department
    // 3: Job Title
    // 4: Line Manager
    // 5: Last Working Day
    // 6: Handover details
    // 7: Handover receiver
    // 8: Laptop/Computer
    // 9: Mobile Phone
    // 10: Other equipment
    // 11: Exit Form
    // 12: Line manager email
    // 13: Email Address
    // 14: Request #
    // 15: Overall Status
    const dataRows = rows.slice(1); // skip header

    let synced = 0;
    let created = 0;

    for (const row of dataRows) {
      const requestNum = parseInt(row[14], 10) || null;
      const fullName = row[1] || '';
      if (!fullName) continue;

      const lastWorkingDay = parseDate(row[5]);
      const sheetStatus = (row[15] || '').trim();

      // Determine the overall status
      let overallStatus: string;
      if (sheetStatus === 'Complete' || sheetStatus === 'Completed') {
        overallStatus = 'Complete';
      } else {
        overallStatus = computeOverallStatus(lastWorkingDay);
      }

      const employeeData = {
        request_number: requestNum,
        timestamp: row[0] ? new Date(row[0]).toISOString() : null,
        full_name: fullName,
        department: row[2] || null,
        job_title: row[3] || null,
        line_manager: row[4] || null,
        last_working_day: lastWorkingDay,
        handover_details: row[6] || null,
        handover_receiver: row[7] || null,
        laptop_status: row[8] || null,
        mobile_status: row[9] || null,
        other_equipment: row[10] || null,
        exit_form_status: row[11] || null,
        line_manager_email: row[12] || null,
        employee_email: row[13] || null,
        overall_status: overallStatus,
      };

      // Upsert employee by request_number
      let employeeId: string;

      if (requestNum) {
        const { data: existing } = await supabase
          .from('offboarding_employees')
          .select('id')
          .eq('request_number', requestNum)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('offboarding_employees')
            .update(employeeData)
            .eq('id', existing.id);
          employeeId = existing.id;
          synced++;
        } else {
          const { data: inserted, error } = await supabase
            .from('offboarding_employees')
            .insert(employeeData)
            .select('id')
            .single();

          if (error || !inserted) {
            console.error('Error inserting employee:', error);
            continue;
          }
          employeeId = inserted.id;
          created++;

          // Auto-generate tasks for new employees
          await generateTasks(employeeId, lastWorkingDay);
        }
      } else {
        // No request number - try to match by name
        const { data: existing } = await supabase
          .from('offboarding_employees')
          .select('id')
          .eq('full_name', fullName)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('offboarding_employees')
            .update(employeeData)
            .eq('id', existing.id);
          synced++;
        } else {
          const { data: inserted, error } = await supabase
            .from('offboarding_employees')
            .insert(employeeData)
            .select('id')
            .single();

          if (error || !inserted) continue;
          created++;
          await generateTasks(inserted.id, lastWorkingDay);
        }
      }
    }

    // Update overdue tasks
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('offboarding_tasks')
      .update({ status: 'Overdue' })
      .lt('due_date', today)
      .neq('status', 'Completed');

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} existing, created ${created} new employees from ${dataRows.length} rows`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

async function generateTasks(employeeId: string, lastWorkingDay: string | null) {
  const tasks = OFFBOARDING_TASK_TEMPLATES.map((template) => {
    let dueDate: string | null = null;
    if (lastWorkingDay) {
      const lwd = new Date(lastWorkingDay);
      const due = new Date(lwd);
      due.setDate(due.getDate() + template.days_offset);
      dueDate = due.toISOString().split('T')[0];
    }

    return {
      employee_id: employeeId,
      task_name: template.task_name,
      task_category: template.task_category,
      task_stage: template.task_stage,
      status: 'Pending',
      due_date: dueDate,
      sort_order: template.sort_order,
    };
  });

  const { error } = await supabase.from('offboarding_tasks').insert(tasks);
  if (error) {
    console.error('Error generating tasks:', error);
  }
}

// Also support GET for manual trigger
export async function GET() {
  return POST();
}
