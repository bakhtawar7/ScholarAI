import React from 'react';
import { ScholarshipFilterFacets } from '../../types';
import {
  Filter,
  RotateCcw,
  Search,
  Globe,
  GraduationCap,
  DollarSign,
  Calendar,
  ShieldCheck,
  CheckCircle,
  SlidersHorizontal,
  X,
  BookOpen,
} from 'lucide-react';

export interface FilterState {
  q: string;
  country: string;
  degreeLevel: string;
  field: string;
  fundingType: string;
  deadline: string;
  nationality: string;
  language: string;
  minGpa: string;
  verificationStatus: string;
  sortBy: string;
}

interface ScholarshipFiltersProps {
  filters: FilterState;
  onChange: (newFilters: Partial<FilterState>) => void;
  onReset: () => void;
  facets?: ScholarshipFilterFacets;
  totalResults: number;
  loading?: boolean;
}

export const ScholarshipFilters: React.FC<ScholarshipFiltersProps> = ({
  filters,
  onChange,
  onReset,
  facets,
  totalResults,
  loading = false,
}) => {
  const activeFilterCount = [
    filters.country,
    filters.degreeLevel,
    filters.field,
    filters.fundingType,
    filters.deadline,
    filters.nationality,
    filters.language,
    filters.minGpa,
    filters.verificationStatus && filters.verificationStatus !== 'VERIFIED' ? filters.verificationStatus : '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Top Search and Sort Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-dark-border shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
              placeholder="Search by title, university, country, field, or keywords..."
              className="w-full bg-dark-card/90 border border-dark-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            />
            {filters.q && (
              <button
                onClick={() => onChange({ q: '' })}
                className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-dark-border text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-medium shrink-0">Sort By:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ sortBy: e.target.value })}
              className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="match">AI Profile Match (Highest)</option>
              <option value="deadline_asc">Earliest Deadline (Urgent)</option>
              <option value="deadline_desc">Latest Deadline</option>
              <option value="newest">Newest Added</option>
              <option value="title_asc">Title (A to Z)</option>
              <option value="funding">Full Funding First</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Selectors Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-3 border-t border-dark-border/40 text-xs">
          {/* Country */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>Country</span>
            </label>
            <select
              value={filters.country}
              onChange={(e) => onChange({ country: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 truncate"
            >
              <option value="">All Countries</option>
              {facets?.countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count})
                </option>
              ))}
              {!facets && (
                <>
                  <option value="Germany">Germany</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United States">United States</option>
                  <option value="Japan">Japan</option>
                  <option value="Singapore">Singapore</option>
                  <option value="South Korea">South Korea</option>
                  <option value="Switzerland">Switzerland</option>
                  <option value="Sweden">Sweden</option>
                  <option value="Australia">Australia</option>
                  <option value="France">France</option>
                </>
              )}
            </select>
          </div>

          {/* Degree Level */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-brand-400" />
              <span>Degree Level</span>
            </label>
            <select
              value={filters.degreeLevel}
              onChange={(e) => onChange({ degreeLevel: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Degrees</option>
              <option value="BACHELORS">Bachelor's Degree</option>
              <option value="MASTERS">Master's Degree</option>
              <option value="PHD">PhD / Doctorate</option>
              <option value="POSTDOC">Postdoctoral Fellowship</option>
            </select>
          </div>

          {/* Field of Study */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-indigo-400" />
              <span>Field of Study</span>
            </label>
            <select
              value={filters.field}
              onChange={(e) => onChange({ field: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 truncate"
            >
              <option value="">All Disciplines</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Artificial Intelligence">Artificial Intelligence</option>
              <option value="Data Science">Data Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Biomedical">Biomedical Sciences</option>
              <option value="Robotics">Robotics</option>
              <option value="Public Policy">Public Policy</option>
              <option value="Business">Business Administration</option>
            </select>
          </div>

          {/* Funding Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Funding Type</span>
            </label>
            <select
              value={filters.fundingType}
              onChange={(e) => onChange({ fundingType: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Funding Types</option>
              <option value="FULL_FUNDING">Full Funding (100%)</option>
              <option value="PARTIAL_FUNDING">Partial Funding</option>
              <option value="TUITION_ONLY">Tuition Waiver Only</option>
              <option value="STIPEND_ONLY">Stipend Only</option>
            </select>
          </div>

          {/* Deadline Presets */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-rose-400" />
              <span>Deadline</span>
            </label>
            <select
              value={filters.deadline}
              onChange={(e) => onChange({ deadline: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Deadlines</option>
              <option value="upcoming">Upcoming / Active Only</option>
              <option value="next_30_days">Closing in 30 Days</option>
              <option value="next_90_days">Closing in 90 Days</option>
              <option value="expired">Past Deadlines</option>
            </select>
          </div>

          {/* Min GPA */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-amber-400" />
              <span>Max Min GPA</span>
            </label>
            <select
              value={filters.minGpa}
              onChange={(e) => onChange({ minGpa: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">Any GPA</option>
              <option value="3.0">GPA &le; 3.0 / 4.0</option>
              <option value="3.3">GPA &le; 3.3 / 4.0</option>
              <option value="3.5">GPA &le; 3.5 / 4.0</option>
              <option value="3.8">GPA &le; 3.8 / 4.0</option>
            </select>
          </div>
        </div>

        {/* Active Filters & Reset Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dark-border/30 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium">
              Found <strong className="text-white">{totalResults}</strong> scholarships
            </span>

            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}

            {/* Individual active chips */}
            {filters.country && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-[10px] text-cyan-300">
                <span>{filters.country}</span>
                <button onClick={() => onChange({ country: '' })} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.degreeLevel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-[10px] text-brand-300">
                <span>{filters.degreeLevel}</span>
                <button onClick={() => onChange({ degreeLevel: '' })} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.field && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-[10px] text-indigo-300">
                <span>{filters.field}</span>
                <button onClick={() => onChange({ field: '' })} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.fundingType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-[10px] text-emerald-300">
                <span>{filters.fundingType.replace('_', ' ')}</span>
                <button onClick={() => onChange({ fundingType: '' })} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.deadline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-[10px] text-rose-300">
                <span>{filters.deadline.replace('_', ' ')}</span>
                <button onClick={() => onChange({ deadline: '' })} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-300 transition underline underline-offset-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset all filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
