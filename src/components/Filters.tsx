'use client';

import { Search } from 'lucide-react';
import { DEPARTMENTS } from '@/lib/config';

type FiltersProps = {
  search: string;
  department: string;
  status: string;
  owner: string;
  onSearchChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onOwnerChange: (v: string) => void;
};

export default function Filters({
  search, department, status, owner,
  onSearchChange, onDepartmentChange, onStatusChange, onOwnerChange,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, department, or job title..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pl-haze/40 focus:border-pl-haze transition-all"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <select
        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pl-haze/40 focus:border-pl-haze"
        value={department}
        onChange={(e) => onDepartmentChange(e.target.value)}
      >
        <option value="">All Departments</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pl-haze/40 focus:border-pl-haze"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="Upcoming">Upcoming</option>
        <option value="In Progress">In Progress</option>
        <option value="Complete">Complete</option>
      </select>
      <select
        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pl-haze/40 focus:border-pl-haze"
        value={owner}
        onChange={(e) => onOwnerChange(e.target.value)}
      >
        <option value="">All Owners</option>
        <option value="HR">HR Tasks</option>
        <option value="Manager">Manager Tasks</option>
        <option value="Employee">Employee Tasks</option>
      </select>
    </div>
  );
}
