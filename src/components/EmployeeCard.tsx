'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Calendar, Briefcase, Building2,
  User, CheckCircle2, Circle, Clock, AlertTriangle, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { EmployeeWithTasks, OffboardingTask } from '@/lib/supabase';

function getStatusColor(status: string | null) {
  switch (status) {
    case 'Complete': return 'bg-green-100 text-green-700 border-green-200';
    case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Upcoming': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function getTaskStatusIcon(task: OffboardingTask) {
  if (task.status === 'Completed') {
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  }
  if (task.status === 'Overdue') {
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }
  if (task.status === 'In Progress') {
    return <Clock className="w-5 h-5 text-blue-500" />;
  }
  return <Circle className="w-5 h-5 text-gray-300" />;
}

export default function EmployeeCard({
  employee,
  onTaskToggle,
}: {
  employee: EmployeeWithTasks;
  onTaskToggle: (taskId: string, currentStatus: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const tasks = employee.offboarding_tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const employeeTasks = tasks.filter((t) => t.task_category === 'Employee');
  const managerTasks = tasks.filter((t) => t.task_category === 'Manager');
  const hrTasks = tasks.filter((t) => t.task_category === 'HR');

  const lastDay = employee.last_working_day
    ? new Date(employee.last_working_day).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : 'TBD';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Card Header */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{employee.full_name}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(employee.overall_status)}`}>
                {employee.overall_status || 'Pending'}
              </span>
              {employee.request_number && (
                <span className="text-xs text-gray-400">#{employee.request_number}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {employee.job_title || 'N/A'}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {employee.department || 'N/A'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Last day: {lastDay}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Manager: {employee.line_manager || 'N/A'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/employee/${employee.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-pl-haze hover:text-pl-haze/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">
              {completedTasks} / {totalTasks} tasks complete
            </span>
            <span className="text-xs font-medium text-pl-haze">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-pl-haze rounded-full h-2 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Task View */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
          <TaskGroup label="Employee Tasks" tasks={employeeTasks} onToggle={onTaskToggle} color="text-pl-haze" />
          <TaskGroup label="Manager Tasks" tasks={managerTasks} onToggle={onTaskToggle} color="text-pl-suede" />
          <TaskGroup label="HR Tasks" tasks={hrTasks} onToggle={onTaskToggle} color="text-green-700" />
          {totalTasks === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No tasks generated yet. Click &quot;Sync &amp; Refresh&quot; to generate tasks.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  label,
  tasks,
  onToggle,
  color,
}: {
  label: string;
  tasks: OffboardingTask[];
  onToggle: (taskId: string, currentStatus: string) => void;
  color: string;
}) {
  if (tasks.length === 0) return null;
  const completed = tasks.filter((t) => t.status === 'Completed').length;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-sm font-semibold ${color}`}>{label}</h4>
        <span className="text-xs text-gray-400">{completed}/{tasks.length}</span>
      </div>
      <div className="space-y-1.5">
        {tasks
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                task.status === 'Completed'
                  ? 'bg-green-50/50'
                  : task.status === 'Overdue'
                  ? 'bg-red-50/50 hover:bg-red-50'
                  : 'hover:bg-white'
              }`}
              onClick={() => onToggle(task.id, task.status)}
            >
              {getTaskStatusIcon(task)}
              <span
                className={`text-sm flex-1 ${
                  task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-700'
                }`}
              >
                {task.task_name}
              </span>
              {task.due_date && (
                <span className={`text-xs ${
                  task.status === 'Overdue' ? 'text-red-500 font-medium' : 'text-gray-400'
                }`}>
                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
