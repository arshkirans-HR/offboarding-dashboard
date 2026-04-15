'use client';

import { Users, Clock, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';

type Stats = {
  totalEmployees: number;
  upcomingDepartures: number;
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
};

export default function StatCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: 'Total Departures',
      value: stats.totalEmployees,
      icon: Users,
      bg: 'bg-pl-haze-light',
      border: 'border-pl-haze/20',
      textColor: 'text-pl-haze',
    },
    {
      label: 'Upcoming Departures',
      value: stats.upcomingDepartures,
      icon: CalendarClock,
      bg: 'bg-pl-monday-light',
      border: 'border-pl-monday/30',
      textColor: 'text-pl-suede',
    },
    {
      label: 'Tasks Completed',
      value: stats.tasksCompleted,
      icon: CheckCircle2,
      bg: 'bg-pl-day-light',
      border: 'border-pl-day/40',
      textColor: 'text-green-700',
    },
    {
      label: 'Pending Tasks',
      value: stats.tasksPending,
      icon: Clock,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      textColor: 'text-amber-700',
    },
    {
      label: 'Overdue Tasks',
      value: stats.tasksOverdue,
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      textColor: 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-5 ${card.bg} ${card.border}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <card.icon className={`w-5 h-5 ${card.textColor}`} />
            <span className={`text-sm font-medium ${card.textColor} opacity-80`}>
              {card.label}
            </span>
          </div>
          <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
