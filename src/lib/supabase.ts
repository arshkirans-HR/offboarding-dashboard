import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OffboardingEmployee = {
  id: string;
  request_number: number | null;
  timestamp: string | null;
  full_name: string;
  department: string | null;
  job_title: string | null;
  line_manager: string | null;
  line_manager_email: string | null;
  employee_email: string | null;
  last_working_day: string | null;
  handover_details: string | null;
  handover_receiver: string | null;
  laptop_status: string | null;
  mobile_status: string | null;
  other_equipment: string | null;
  exit_form_status: string | null;
  overall_status: string | null;
  created_at: string;
  updated_at: string;
};

export type OffboardingTask = {
  id: string;
  employee_id: string;
  task_name: string;
  task_category: string; // 'Employee' | 'HR' | 'Manager'
  status: string; // 'Pending' | 'In Progress' | 'Completed' | 'Overdue'
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EmployeeWithTasks = OffboardingEmployee & {
  offboarding_tasks: OffboardingTask[];
};
