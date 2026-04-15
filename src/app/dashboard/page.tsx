'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, EmployeeWithTasks } from '@/lib/supabase';
import Header from '@/components/Header';
import StatCards from '@/components/StatCards';
import Filters from '@/components/Filters';
import EmployeeCard from '@/components/EmployeeCard';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [employees, setEmployees] = useState<EmployeeWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('offboarding_employees')
      .select('*, offboarding_tasks(*)')
      .order('last_working_day', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      setEmployees((data as EmployeeWithTasks[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('offboarding-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offboarding_employees' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offboarding_tasks' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'Completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = 'HR';
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    await supabase.from('offboarding_tasks').update(updates).eq('id', taskId);

    // Check if all tasks for this employee are completed
    const task = employees
      .flatMap((e) => e.offboarding_tasks)
      .find((t) => t.id === taskId);
    if (task) {
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
        />
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-pl-haze animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg">No departing employees found</p>
            <p className="text-sm mt-1">
              Click &quot;Sync &amp; Refresh&quot; to pull data from Google Sheets
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                onTaskToggle={handleTaskToggle}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
