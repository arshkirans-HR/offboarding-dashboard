// Effective date â only show offboarding records with last_working_day on or after this date
export const EFFECTIVE_DATE = '2026-04-16';

// Offboarding task templates - auto-generated for each departing employee
export type TaskTemplate = {
  task_name: string;
  task_category: 'Employee' | 'HR' | 'Manager';
  days_offset: number; // days before last working day (negative = before, 0 = on day, positive = after)
  sort_order: number;
};

export const OFFBOARDING_TASK_TEMPLATES: TaskTemplate[] = [
  // ââ Employee Tasks ââ
  { task_name: 'Submit resignation letter / confirmation', task_category: 'Employee', days_offset: -30, sort_order: 1 },
  { task_name: 'Complete handover documentation', task_category: 'Employee', days_offset: -7, sort_order: 2 },
  { task_name: 'Transfer knowledge to handover receiver', task_category: 'Employee', days_offset: -5, sort_order: 3 },
  { task_name: 'Return laptop / computer', task_category: 'Employee', days_offset: 0, sort_order: 4 },
  { task_name: 'Return mobile phone', task_category: 'Employee', days_offset: 0, sort_order: 5 },
  { task_name: 'Return other company equipment', task_category: 'Employee', days_offset: 0, sort_order: 6 },
  { task_name: 'Return access cards / keys', task_category: 'Employee', days_offset: 0, sort_order: 7 },
  { task_name: 'Complete exit interview form', task_category: 'Employee', days_offset: -3, sort_order: 8 },
  { task_name: 'Clear personal belongings from workspace', task_category: 'Employee', days_offset: 0, sort_order: 9 },
  { task_name: 'Submit final expense claims', task_category: 'Employee', days_offset: -5, sort_order: 10 },

  // ââ Manager Tasks ââ
  { task_name: 'Acknowledge resignation', task_category: 'Manager', days_offset: -28, sort_order: 11 },
  { task_name: 'Identify handover receiver', task_category: 'Manager', days_offset: -21, sort_order: 12 },
  { task_name: 'Review and approve handover documentation', task_category: 'Manager', days_offset: -5, sort_order: 13 },
  { task_name: 'Confirm knowledge transfer is complete', task_category: 'Manager', days_offset: -3, sort_order: 14 },
  { task_name: 'Redistribute team responsibilities', task_category: 'Manager', days_offset: -3, sort_order: 15 },
  { task_name: 'Complete manager exit survey', task_category: 'Manager', days_offset: -1, sort_order: 16 },
  { task_name: 'Communicate departure to stakeholders', task_category: 'Manager', days_offset: -7, sort_order: 17 },
  { task_name: 'Update team org chart', task_category: 'Manager', days_offset: 0, sort_order: 18 },

  // ââ HR Tasks ââ
  { task_name: 'Process resignation in HRIS', task_category: 'HR', days_offset: -28, sort_order: 19 },
  { task_name: 'Calculate final settlement / EOSB', task_category: 'HR', days_offset: -7, sort_order: 20 },
  { task_name: 'Schedule exit interview', task_category: 'HR', days_offset: -10, sort_order: 21 },
  { task_name: 'Conduct exit interview', task_category: 'HR', days_offset: -3, sort_order: 22 },
  { task_name: 'Revoke email access', task_category: 'HR', days_offset: 0, sort_order: 23 },
  { task_name: 'Revoke system / VPN access', task_category: 'HR', days_offset: 0, sort_order: 24 },
  { task_name: 'Revoke Slack access', task_category: 'HR', days_offset: 0, sort_order: 25 },
  { task_name: 'Revoke tool-specific access (Jira, GitHub, etc.)', task_category: 'HR', days_offset: 0, sort_order: 26 },
  { task_name: 'Confirm equipment returned', task_category: 'HR', days_offset: 1, sort_order: 27 },
  { task_name: 'Process visa / work permit cancellation', task_category: 'HR', days_offset: 5, sort_order: 28 },
  { task_name: 'Issue experience letter', task_category: 'HR', days_offset: 3, sort_order: 29 },
  { task_name: 'Process final payroll', task_category: 'HR', days_offset: 5, sort_order: 30 },
  { task_name: 'Archive employee records', task_category: 'HR', days_offset: 7, sort_order: 31 },
  { task_name: 'Remove from company insurance', task_category: 'HR', days_offset: 1, sort_order: 32 },
  { task_name: 'Send offboarding completion confirmation', task_category: 'HR', days_offset: 7, sort_order: 33 },
];

export const DEPARTMENTS = [
  'Sales',
  'Product',
  'Marketing',
  'HR',
  'Attractions',
  'Operations',
  'Finance',
  'Customer Support',
  'Development',
  'Business Events',
  'Analytics',
  'Design',
];

// Platinumlist brand colors
export const BRAND_COLORS = {
  sabbath: '#1a1a2e',    // Dark navy - header
  haze: '#6C63FF',       // Purple - primary accent
  monday: '#e2e8f0',     // Light gray - text on dark
  suede: '#8B7355',      // Brown - secondary
  day: '#10B981',        // Green - success
};
