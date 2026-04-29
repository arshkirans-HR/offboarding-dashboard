'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, EmployeeWithTasks, OffboardingTask } from '@/lib/supabase';
import { getVisibleTaskCategories, canToggleTaskCategory } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Briefcase, Building2, User, Mail,
  CheckCircle2, Circle, Clock, AlertTriangle, Laptop,
  Smartphone, FileText, Package, UserCheck, Lock,
} from 'lucide-react';

function getTaskStatusIcon(task: OffboardingTask) {
  if (task.status === 'Completed') return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
  if (task.status === 'Overdue') return <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />;
  if (task.status === 'In Progress') return <Clock className="w-5 h-5 text-blue-500 shrink-0" />;
  return <Circle className="w-5 h-5 text-gray-300 shrink-0" />;
}

function EmployeeDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<EmployeeWithTasks | null>(null);
  const [loading, setLoading] = useState(true);

  const visibleCategories = getVisibleTaskCategories(user?.role ?? null);

  // Check access permissions
  const hasAccess = useCallback(() => {
    if (!user?.role) return false;
    if (user.role === 'HR') return true;
    if (user.role === 'Manager') {
      return user.managedEmployeeIds.includes(params.id as string) ||
             user.employeeRecordId === params.id;
    }
    if (user.role === 'Employee') {
      return user.employeeRecordId === params.id;
    }
    return false;
  }, [user, params.id]);

  const fetchEmployee = useCallback(async () => {
    if (!hasAccess()) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('offboarding_employees')
      .select('*, offboarding_tasks(*)')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error:', error);
    } else {
      // Filter tasks by visible categories
      const emp = data as EmployeeWithTasks;
      emp.offboarding_tasks = emp.offboarding_tasks.filter((t) =>
        visibleCategories.includes(t.task_category)
      );
      setEmployee(emp);
    }
    setLoading(false);
  }, [params.id, hasAccess, visibleCategories]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    const task = employee?.offboarding_tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (!canToggleTaskCategory(user?.role ?? null, task.task_category)) {
      return;
    }

    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'Completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user?.email || user?.role || 'Unknown';
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }
    await supabase.from('offboarding_tasks').update(updates).eq('id', taskId);

    // Auto-complete employee if all tasks done
    if (employee) {
      const allTasks = employee.offboarding_tasks;
      const othersDone = allTasks.filter((t) => t.id !== taskId).every((t) => t.status === 'Completed');
      if (newStatus === 'Completed' && othersDone) {
        await supabase.from('offboarding_employees').update({ overall_status: 'Complete' }).eq('id', employee.id);
      } else if (newStatus !== 'Completed') {
        await supabase.from('offboarding_employees').update({ overall_status: 'In Progress' }).eq('id', employee.id);
      }
    }

    fetchEmployee();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Clock className="w-8 h-8 text-pl-haze animate-spin" />
        </div>
      </div>
    );
  }

  if (!hasAccess()) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Access Denied</p>
          <p className="text-sm text-gray-400 mb-4">You don&apos;t have permission to view this employee&apos;s details.</p>
          <Link href="/dashboard" className="text-pl-haze hover:underline text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-gray-500">Employee not found.</p>
          <Link href="/dashboard" className="text-pl-haze hover:underline mt-2 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tasks = employee.offboarding_tasks || [];
  const employeeTasks = tasks.filter((t) => t.task_category === 'Employee').sort((a, b) => a.sort_order - b.sort_order);
  const managerTasks = tasks.filter((t) => t.task_category === 'Manager').sort((a, b) => a.sort_order - b.sort_order);
  const hrTasks = tasks.filter((t) => t.task_category === 'HR').sort((a, b) => a.sort_order - b.sort_order);
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const lastDay = employee.last_working_day
    ? new Date(employee.last_working_day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onRefresh={fetchEmployee} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-pl-haze mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Employee Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{employee.full_name}</h2>
              <p className="text-gray-500 mt-1">{employee.job_title || ""} &middot; {employee.department || ""}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${
                employee.overall_status === 'Complete'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : employee.overall_status === 'In Progress'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
              }`}
            >
              {employee.overall_status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <InfoItem icon={Calendar} label="Last Working Day" value={lastDay} />
            <InfoItem icon={User} label="Line Manager" value={employee.line_manager || 'N/A'} />
            {user?.role === 'HR' && (
              <>
                <InfoItem icon={Mail} label="Manager Email" value={employee.line_manager_email || 'N/A'} />
                <InfoItem icon={Mail} label="Employee Email" value={employee.employee_email || 'N/A'} />
              </>
            )}
            <InfoItem icon={UserCheck} label="Handover To" value={employee.handover_receiver || 'N/A'} />
            <InfoItem icon={FileText} label="Exit Form" value={employee.exit_form_status || 'Not submitted'} />
            <InfoItem icon={Laptop} label="Laptop" value={employee.laptop_status || 'N/A'} />
            <InfoItem icon={Smartphone} label="Mobile" value={employee.mobile_status || 'N/A'} />
            <InfoItem icon={Package} label="Other Equipment" value={employee.other_equipment || 'N/A'} />
          </div>

          {employee.handover_details && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Handover Details</p>
              <p className="text-sm text-gray-700">{employee.handover_details}</p>
            </div>
          )}

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">
                Overall Progress: {completedCount} / {tasks.length} tasks
              </span>
              <span className="text-sm font-semibold text-pl-haze">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="bg-pl-haze rounded-full h-3 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task Sections */}
        <div className="space-y-6">
          {employeeTasks.length > 0 && (
            <TaskSection
              title="Employee Tasks"
              color="pl-haze"
              tasks={employeeTasks}
              onToggle={handleTaskToggle}
              canToggle={canToggleTaskCategory(user?.role ?? null, 'Employee')}
            />
          )}
          {managerTasks.length > 0 && (
            <TaskSection
              title="Manager Tasks"
              color="pl-suede"
              tasks={managerTasks}
              onToggle={handleTaskToggle}
              canToggle={canToggleTaskCategory(user?.role ?? null, 'Manager')}
            />
          )}
          {hrTasks.filter(t => t.task_stage === 'Handover Stage').length > 0 && (
            <TaskSection
              title="Handover Stage"
              color="green-700"
              tasks={hrTasks.filter(t => t.task_stage === 'Handover Stage')}
              onToggle={handleTaskToggle}
              canToggle={canToggleTaskCategory(user?.role ?? null, 'HR')}
            />
          )}
          {hrTasks.filter(t => t.task_stage === 'Last Working Day').length > 0 && (
            <TaskSection
              title="Last Working Day"
              color="green-700"
              tasks={hrTasks.filter(t => t.task_stage === 'Last Working Day')}
              onToggle={handleTaskToggle}
              canToggle={canToggleTaskCategory(user?.role ?? null, 'HR')}
            />
          )}
          {hrTasks.filter(t => t.task_stage === 'Post Exit').length > 0 && (
            <TaskSection
              title="Post Exit"
              color="green-700"
              tasks={hrTasks.filter(t => t.task_stage === 'Post Exit')}
              onToggle={handleTaskToggle}
              canToggle={canToggleTaskCategory(user?.role ?? null, 'HR')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function EmployeeDetailPage() {
  return (
    <AuthGuard>
      <EmployeeDetailContent />
    </AuthGuard>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700 break-all">{value}</p>
      </div>
    </div>
  );
}

function TaskSection({
  title,
  color,
  tasks,
  onToggle,
  canToggle = true,
}: {
  title: string;
  color: string;
  tasks: OffboardingTask[];
  onToggle: (id: string, status: string) => void;
  canToggle?: boolean;
}) {
  if (tasks.length === 0) return null;
  const completed = tasks.filter((t) => t.status === 'Completed').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between`}>
        <h3 className={`text-base font-semibold text-${color}`}>{title}</h3>
        <div className="flex items-center gap-2">
          {!canToggle && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> View only
            </span>
          )}
          <span className="text-sm text-gray-400">{completed} / {tasks.length} complete</span>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-4 px-6 py-3 transition-colors ${
              canToggle ? 'cursor-pointer' : 'cursor-default'
            } ${
              task.status === 'Completed' ? 'bg-green-50/30' : task.status === 'Overdue' ? 'bg-red-50/30 hover:bg-red-50/50' : canToggle ? 'hover:bg-gray-50' : ''
            }`}
            onClick={() => canToggle && onToggle(task.id, task.status)}
          >
            {getTaskStatusIcon(task)}
            <span className={`flex-1 text-sm ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {task.task_name}
            </span>
            {task.due_date && (
              <span className={`text-xs ${task.status === 'Overdue' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                Due: {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.completed_at && (
              <span className="text-xs text-green-500">
                Done {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

