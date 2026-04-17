'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, EmployeeWithTasks } from '@/lib/supabase';
import { EFFECTIVE_DATE } from '@/lib/config';
import { getVisibleTaskCategories, canToggleTaskCategory } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import StatCards from '@/components/StatCards';
import Filters from '@/components/Filters';
import EmployeeCard from '@/components/EmployeeCard';
import { RefreshCw } from 'lucide-react';

function DashboardContent() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');

  const visibleCategories = getVisibleTaskCategories(user?.role ?? null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('offboarding_employees')
      .select('*, offboarding_tasks(*)')
      .gte('last_working_day', EFFECTIVE_DATE)
      .order('last_working_day', { ascending: false });

    // Role-based data filtering
    if (user?.role === 'Employee' && user.employeeRecordId) {
      // Employee only sees their own record
      query = query.eq('id', user.employeeRecordId);
    } else if (user?.role === 'Manager' && user.managedEmployeeIds.length > 0) {
      // Manager sees employees they manage (and optionally their own record)
      const ids = [...user.managedEmployeeIds];
      if (user.employeeRecordId) ids.push(user.employeeRecordId);
      query = query.in('id', ids);
    }
    // HR sees everything â no filter

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      // Filter tasks by visible categories
      const filtered = ((data as EmployeeWithTasks[]) || []).map((emp) => ({
        ...emp,
        offboarding_tasks: emp.offboarding_tasks.filter((t) =>
          visibleCategories.includes(t.task_category)
        ),
      }));
      setEmployees(filtered);
    }
    setLoading(false);
  }, [user, visibleCategories]);

  useEffect(() => {
    if (user?.role) {
      fetchData();
    }

    // Real-time subscription
    const channel = supabase
      .channel('offboarding-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offboarding_employees' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offboarding_tasks' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, user?.role]);

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    // Find the task to check permissions
    const task = employees
      .flatMap((e) => e.offboarding_tasks)
      .find((t) => t.id === taskId);

    if (!task) return;

    // Check if the user can toggle this task category
    if (!canToggleTaskCategory(user?.role ?? null, task.task_category)) {
      return; // Silently ignore â UI should already prevent this
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

    // Check if all tasks for this employee are completed
    const emp = employees.find((e) => e.id === task.employee_id);
    if (emp) {
      const allTasks = emp.offboarding_tasks;
      const otherTasksCompleted = allTasks
        .filter((t) => t.id !== taskId)
        .every((t) => t.status === 'Completed');
      if (newStatus === 'Completed' && otherTasksCompleted) {
        await supabase
          .from('offboarding_employees')
          .update({ overall_status: 'Complete' })
          .eq('id', emp.id);
      } else if (newStatus !== 'Completed') {
        await supabase
          .from('offboarding_employees')
          .update({ overall_status: 'In Progress' })
          .eq('id', emp.id);
      }
    }

    fetchData();
  };

  // Filter employees
  const filtered = employees.filter((emp) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      emp.full_name.toLowerCase().includes(searchLower) ||
      (emp.department || '').toLowerCase().includes(searchLower) ||
      (emp.job_title || '').toLowerCase().includes(searchLower);

    const matchesDept = !department || emp.department === department;
    const matchesStatus = !status || emp.overall_status === status;

    const matchesOwner =
      !owner ||
      emp.offboarding_tasks.some((t) => t.task_category === owner && t.status !== 'Completed');

    return matchesSearch && matchesDept && matchesStatus && matchesOwner;
  });

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allTasks = employees.flatMap((e) => e.offboarding_tasks);

  const stats = {
    totalEmployees: employees.length,
    upcomingDepartures: employees.filter((e) => {
      if (!e.last_working_day) return false;
      return new Date(e.last_working_day) > today;
    }).length,
    tasksCompleted: allTasks.filter((t) => t.status === 'Completed').length,
    tasksPending: allTasks.filter((t) => t.status === 'Pending' || t.status === 'In Progress').length,
    tasksOverdue: allTasks.filter((t) => {
      if (t.status === 'Completed') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < today;
    }).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onRefresh={fetchData} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Role-specific welcome banner */}
        {user?.role === 'Employee' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-6 py-4">
            <p className="text-sm text-green-800">
              <strong>Welcome!</strong> Below are your offboarding tasks. Please complete them before your last working day.
            </p>
          </div>
        )}
        {user?.role === 'Manager' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-6 py-4">
            <p className="text-sm text-amber-800">
              <strong>Manager View</strong> â You can see Employee and Manager tasks for your direct reports. Complete the Manager tasks assigned to you.
            </p>
          </div>
        )}

        <StatCards stats={stats} />
        <Filters
          search={search}
          department={department}
          status={status}
          owner={owner}
          onSearchChange={setSearch}
          onDepartmentChange={setDepartment}
          onStatusChange={setStatus}
          onOwnerChange={setOwner}
          visibleCategories={visibleCategories}
        />
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-pl-haze animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg">No departing employees found</p>
            {user?.role === 'HR' && (
              <p className="text-sm mt-1">
                Click &quot;Sync &amp; Refresh&quot; to pull data from Google Sheets
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                onTaskToggle={handleTaskToggle}
                userRole={user?.role ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
