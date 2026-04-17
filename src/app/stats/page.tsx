'use client';

import { useEffect, useState } from 'react';
import { supabase, EmployeeWithTasks } from '@/lib/supabase';
import { EFFECTIVE_DATE } from '@/lib/config';
import Header from '@/components/Header';
import AuthGuard from '@/components/AuthGuard';
import { BarChart3, Users, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

function StatsContent() {
  const [employees, setEmployees] = useState<EmployeeWithTasks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('offboarding_employees')
        .select('*, offboarding_tasks(*)')
        .gte('last_working_day', EFFECTIVE_DATE);
      setEmployees((data as EmployeeWithTasks[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const allTasks = employees.flatMap((e) => e.offboarding_tasks || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Department breakdown
  const deptMap = new Map<string, { total: number; completed: number; inProgress: number }>();
  employees.forEach((emp) => {
    const dept = emp.department || 'Unknown';
    if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, completed: 0, inProgress: 0 });
    const d = deptMap.get(dept)!;
    d.total++;
    if (emp.overall_status === 'Complete') d.completed++;
    else d.inProgress++;
  });

  // Category breakdown
  const catBreakdown = {
    Employee: { total: 0, completed: 0 },
    Manager: { total: 0, completed: 0 },
    HR: { total: 0, completed: 0 },
  };
  allTasks.forEach((t) => {
    const cat = t.task_category as keyof typeof catBreakdown;
    if (catBreakdown[cat]) {
      catBreakdown[cat].total++;
      if (t.status === 'Completed') catBreakdown[cat].completed++;
    }
  });

  // Monthly departures
  const monthMap = new Map<string, number>();
  employees.forEach((emp) => {
    if (emp.last_working_day) {
      const d = new Date(emp.last_working_day);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  });
  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Overdue by owner
  const overdueByOwner = { Employee: 0, Manager: 0, HR: 0 };
  allTasks.forEach((t) => {
    if (t.status !== 'Completed' && t.due_date && new Date(t.due_date) < today) {
      const cat = t.task_category as keyof typeof overdueByOwner;
      if (overdueByOwner[cat] !== undefined) overdueByOwner[cat]++;
    }
  });

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-pl-haze" />
          Offboarding Analytics
        </h2>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MiniStat icon={Users} label="Total Departures" value={employees.length} color="text-pl-haze" bg="bg-pl-haze-light" />
          <MiniStat icon={CheckCircle2} label="Fully Offboarded" value={employees.filter((e) => e.overall_status === 'Complete').length} color="text-green-700" bg="bg-green-50" />
          <MiniStat icon={TrendingUp} label="Task Completion Rate" value={`${allTasks.length > 0 ? Math.round((allTasks.filter((t) => t.status === 'Completed').length / allTasks.length) * 100) : 0}%`} color="text-blue-700" bg="bg-blue-50" />
          <MiniStat icon={AlertTriangle} label="Total Overdue" value={Object.values(overdueByOwner).reduce((a, b) => a + b, 0)} color="text-red-600" bg="bg-red-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">By Department</h3>
            <div className="space-y-3">
              {Array.from(deptMap.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .map(([dept, data]) => (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{dept}</span>
                      <span className="text-xs text-gray-400">
                        {data.completed}/{data.total} complete
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-pl-haze rounded-full h-2 transition-all"
                        style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Task Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tasks by Owner</h3>
            <div className="space-y-4">
              {Object.entries(catBreakdown).map(([cat, data]) => (
                <div key={cat} className="flex items-center gap-4">
                  <span className={`text-sm font-medium w-20 ${
                    cat === 'HR' ? 'text-green-700' : cat === 'Manager' ? 'text-pl-suede' : 'text-pl-haze'
                  }`}>{cat}</span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className={`rounded-full h-3 transition-all ${
                          cat === 'HR' ? 'bg-green-500' : cat === 'Manager' ? 'bg-amber-500' : 'bg-pl-haze'
                        }`}
                        style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">{data.completed}/{data.total}</span>
                </div>
              ))}
            </div>

            {/* Overdue by owner */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-red-600 mb-3">Overdue Tasks by Owner</h4>
              <div className="flex gap-4">
                {Object.entries(overdueByOwner).map(([owner, count]) => (
                  <div key={owner} className="flex-1 p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{count}</p>
                    <p className="text-xs text-red-500">{owner}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Departures */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 lg:col-span-2">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Departures</h3>
            {sortedMonths.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No departure data available</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {sortedMonths.map(([month, count]) => {
                  const maxCount = Math.max(...sortedMonths.map(([, c]) => c));
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const [y, m] = month.split('-');
                  const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-pl-haze">{count}</span>
                      <div
                        className="w-full bg-pl-haze/80 rounded-t-md transition-all hover:bg-pl-haze min-h-[4px]"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-gray-400">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl p-5 ${bg} border border-gray-100`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`text-sm font-medium ${color} opacity-80`}>{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function StatsPage() {
  return (
    <AuthGuard>
      <StatsContent />
    </AuthGuard>
  );
}
