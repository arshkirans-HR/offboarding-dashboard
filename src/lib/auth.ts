import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Auth-enabled Supabase client (singleton)
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

export type UserRole = 'HR' | 'Manager' | 'Employee' | null;

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  // For managers: the employee IDs they manage
  managedEmployeeIds: string[];
  // For employees: their own offboarding record ID (if any)
  employeeRecordId: string | null;
};

const HR_EMAILS = [
  'hr@platinumlist.net',
  'daria.kvashnina@platinumlist.net',
  'siddh.r@platinumlist.net',
  'arshkiran.s@platinumlist.net',
];

/**
 * Detect the user's role based on their email address.
 * Priority: HR > Manager > Employee
 */
export async function detectUserRole(email: string): Promise<{
  role: UserRole;
  managedEmployeeIds: string[];
  employeeRecordId: string | null;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if HR
  if (HR_EMAILS.includes(normalizedEmail)) {
    return { role: 'HR', managedEmployeeIds: [], employeeRecordId: null };
  }

  // Check if this email is a line manager for any offboarding employees
  const { data: managedEmployees } = await supabaseAuth
    .from('offboarding_employees')
    .select('id')
    .ilike('line_manager_email', normalizedEmail);

  if (managedEmployees && managedEmployees.length > 0) {
    const managedIds = managedEmployees.map((e) => e.id);

    // Also check if they themselves are an offboarding employee
    const { data: selfRecord } = await supabaseAuth
      .from('offboarding_employees')
      .select('id')
      .ilike('employee_email', normalizedEmail)
      .maybeSingle();

    return {
      role: 'Manager',
      managedEmployeeIds: managedIds,
      employeeRecordId: selfRecord?.id || null,
    };
  }

  // Check if this email is an offboarding employee
  const { data: employeeRecord } = await supabaseAuth
    .from('offboarding_employees')
    .select('id')
    .ilike('employee_email', normalizedEmail)
    .maybeSingle();

  if (employeeRecord) {
    return {
      role: 'Employee',
      managedEmployeeIds: [],
      employeeRecordId: employeeRecord.id,
    };
  }

  // No role found - could be a platinumlist employee not in offboarding
  return { role: null, managedEmployeeIds: [], employeeRecordId: null };
}

/**
 * Get the currently signed-in Supabase user
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

/**
 * Sign in with magic link (email)
 */
export async function signInWithMagicLink(email: string): Promise<{ error: string | null }> {
  // Only allow @platinumlist.net emails
  if (!email.toLowerCase().endsWith('@platinumlist.net')) {
    return { error: 'Only @platinumlist.net email addresses are allowed.' };
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await supabaseAuth.auth.signOut();
}

/**
 * Determine which task categories a role can see
 */
export function getVisibleTaskCategories(role: UserRole): string[] {
  switch (role) {
    case 'HR':
      return ['Employee', 'Manager', 'HR'];
    case 'Manager':
      return ['Employee', 'Manager'];
    case 'Employee':
      return ['Employee'];
    default:
      return [];
  }
}

/**
 * Check if a role can toggle (complete/uncomplete) tasks in a category
 */
export function canToggleTaskCategory(role: UserRole, taskCategory: string): boolean {
  switch (role) {
    case 'HR':
      return true; // HR can toggle everything
    case 'Manager':
      return taskCategory === 'Manager'; // Managers toggle their own tasks
    case 'Employee':
      return taskCategory === 'Employee'; // Employees toggle their own tasks
    default:
      return false;
  }
}
