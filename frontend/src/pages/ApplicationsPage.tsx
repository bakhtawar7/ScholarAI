import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { LoadingState, ErrorState, InlineError } from '../components/common/States';
import { Application, ApplicationStatus } from '../types';
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  KanbanSquare,
  ListTodo,
  Plus,
  Save,
  Search,
  Square,
  Trash2,
} from 'lucide-react';

const statuses: { key: ApplicationStatus; label: string; color: string; badge: string }[] = [
  {
    key: 'INTERESTED',
    label: 'Interested',
    color: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
  {
    key: 'PREPARING',
    label: 'Preparing Docs',
    color: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    badge: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
  },
  {
    key: 'READY_TO_APPLY',
    label: 'Ready to Apply',
    color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    key: 'APPLIED',
    label: 'Submitted / Applied',
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    key: 'INTERVIEW',
    label: 'Interview Phase',
    color: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    key: 'ACCEPTED',
    label: 'Accepted 🎉',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    key: 'REJECTED',
    label: 'Rejected',
    color: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
];

export const ApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [openNotesMap, setOpenNotesMap] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getApplications();
      const list = Array.isArray(data) ? data : [];
      setApplications(list);
      const notesMap: Record<string, string> = {};
      list.forEach((a: any) => {
        notesMap[a.id] = a.notes || '';
      });
      setEditingNotes(notesMap);
    } catch (err) {
      // Distinguish a failed load from a genuinely empty tracker.
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your applications.');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    try {
      const updated = await api.updateApplicationStatus(appId, { status: newStatus });
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus, submissionDate: updated.submissionDate } : a))
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleToggleChecklist = async (appId: string, checklistId: string) => {
    try {
      await api.toggleChecklistItem(checklistId);
      setApplications((prev) =>
        prev.map((a) => {
          if (a.id === appId) {
            return {
              ...a,
              checklists: a.checklists.map((c) => (c.id === checklistId ? { ...c, isCompleted: !c.isCompleted } : c)),
            };
          }
          return a;
        })
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleAddChecklist = async (appId: string) => {
    const text = newItemText[appId];
    if (!text || !text.trim()) return;

    try {
      const newItem = await api.addChecklistItem(appId, { item: text.trim() });
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, checklists: [...a.checklists, newItem] } : a))
      );
      setNewItemText((prev) => ({ ...prev, [appId]: '' }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleDeleteChecklistItem = async (appId: string, checklistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteChecklistItem(checklistId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, checklists: a.checklists.filter((c) => c.id !== checklistId) } : a))
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handlePopulateStandardTemplate = async (appId: string) => {
    try {
      const updatedApps = await api.populateStandardChecklist(appId);
      setApplications(updatedApps);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleSaveNotes = async (appId: string) => {
    try {
      const notes = editingNotes[appId] || '';
      await api.updateApplication(appId, { notes });
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, notes } : a)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleSubmissionDateChange = async (appId: string, dateStr: string) => {
    try {
      const submissionDate = dateStr ? new Date(dateStr) : null;
      await api.updateApplication(appId, { submissionDate });
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, submissionDate: dateStr } : a)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const handleDeleteApplication = async (appId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from your Application Tracker?`)) return;

    try {
      await api.deleteApplication(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    }
  };

  const calculateDaysRemaining = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Filter applications by search and status tab
  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      !searchQuery ||
      app.scholarship.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.scholarship.hostCountry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatusTab === 'ALL' || app.status === selectedStatusTab;

    return matchesSearch && matchesStatus;
  });

  const totalApps = applications.length;
  const inPreparation = applications.filter(
    (a) => a.status === 'INTERESTED' || a.status === 'PREPARING' || a.status === 'READY_TO_APPLY'
  ).length;
  const submitted = applications.filter((a) => a.status === 'APPLIED' || a.status === 'INTERVIEW').length;
  const accepted = applications.filter((a) => a.status === 'ACCEPTED').length;

  if (loading) {
    return <LoadingState message="Loading your application board and checklists…" />;
  }

  if (loadError) {
    return <ErrorState title="Could not load applications" message={loadError} onRetry={() => void fetchApps()} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {actionError && <InlineError message={actionError} onDismiss={() => setActionError(null)} />}
      {/* Header & Metric Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <KanbanSquare className="w-6 h-6 text-brand-400" />
            <span>Application Tracker & Checklists</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your scholarship application milestones, document checklists, submission cutoffs, and status stages.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm">
            <span>Total:</span>
            <strong className="text-cyan-400">{totalApps}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm">
            <span>Preparing:</span>
            <strong className="text-brand-300">{inPreparation}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm">
            <span>Submitted:</span>
            <strong className="text-indigo-300">{submitted}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm">
            <span>Accepted:</span>
            <strong className="text-emerald-400">{accepted} 🎉</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl glass-card border border-dark-border flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracked applications..."
            className="w-full bg-dark-bg border border-dark-border rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-none text-xs">
          <button
            onClick={() => setSelectedStatusTab('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap ${
              selectedStatusTab === 'ALL'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-dark-hover'
            }`}
          >
            All Stages ({totalApps})
          </button>
          {statuses.map((s) => {
            const count = applications.filter((a) => a.status === s.key).length;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedStatusTab(s.key)}
                className={`px-2.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1 ${
                  selectedStatusTab === s.key
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-dark-hover'
                }`}
              >
                <span>{s.label}</span>
                <span className="w-4 h-4 rounded-full bg-dark-bg/60 text-2xs flex items-center justify-center">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 overflow-x-auto pb-6">
        {statuses
          .filter((col) => selectedStatusTab === 'ALL' || selectedStatusTab === col.key)
          .map((col) => {
            const colApps = filteredApplications.filter((a) => a.status === col.key);

            return (
              <div key={col.key} className="space-y-3 min-w-[280px] xl:min-w-[240px]">
                {/* Column Header */}
                <div
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm ${col.color}`}
                >
                  <span>{col.label}</span>
                  <span className="w-5 h-5 rounded-full bg-dark-bg/80 flex items-center justify-center text-2xs font-extrabold text-white">
                    {colApps.length}
                  </span>
                </div>

                {/* Cards in Column */}
                <div className="space-y-3">
                  {colApps.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-dark-border text-center text-slate-500 text-2xs">
                      No applications in this stage
                    </div>
                  ) : (
                    colApps.map((app) => {
                      const completedCount = app.checklists.filter((c) => c.isCompleted).length;
                      const totalCount = app.checklists.length;
                      const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                      const daysRemaining = calculateDaysRemaining(app.scholarship.deadline);
                      const isExpired = daysRemaining !== null && daysRemaining < 0;
                      const isCritical = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;
                      const isNotesOpen = openNotesMap[app.id];

                      return (
                        <div
                          key={app.id}
                          className="p-4 rounded-2xl glass-card border border-dark-border hover:border-brand-500/40 space-y-3 shadow-lg transition"
                        >
                          {/* Top: Country & Delete Action */}
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-2xs text-cyan-400 font-bold uppercase tracking-wider">
                              {app.scholarship.hostCountry}
                            </span>
                            <button
                              onClick={() => handleDeleteApplication(app.id, app.scholarship.title)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                              title="Delete from tracker"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Scholarship Title */}
                          <Link
                            to={`/scholarships/${app.scholarship.id}`}
                            className="font-bold text-xs text-white hover:text-cyan-300 transition line-clamp-2 leading-snug block"
                          >
                            {app.scholarship.title}
                          </Link>

                          {/* Deadline & Urgency Badge */}
                          {app.scholarship.deadline && (
                            <div className="flex items-center justify-between text-2xs pt-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-400" />
                                {new Date(app.scholarship.deadline).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold border ${
                                  isExpired
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : isCritical
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {isExpired ? 'Closed' : `${daysRemaining}d left`}
                              </span>
                            </div>
                          )}

                          {/* Status Dropdown Selector */}
                          <div>
                            <label className="text-2xs font-semibold text-slate-400 block mb-1">Stage:</label>
                            <select
                              value={app.status}
                              onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                              className="w-full bg-dark-bg border border-dark-border rounded-xl px-2.5 py-1.5 text-2xs text-slate-200 font-semibold focus:outline-none focus:border-brand-500 transition"
                            >
                              {statuses.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Submission Date Picker */}
                          <div className="p-2 rounded-xl bg-dark-bg/60 border border-dark-border/40 text-2xs space-y-1">
                            <label className="text-slate-400 font-semibold block flex items-center justify-between">
                              <span>Submission Date:</span>
                              {app.submissionDate && (
                                <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  Recorded
                                </span>
                              )}
                            </label>
                            <input
                              type="date"
                              value={app.submissionDate ? new Date(app.submissionDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => handleSubmissionDateChange(app.id, e.target.value)}
                              className="w-full bg-dark-card border border-dark-border rounded-lg px-2 py-1 text-2xs text-white focus:outline-none focus:border-brand-500"
                            />
                          </div>

                          {/* Checklist Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-2xs text-slate-400">
                              <span>Checklist Progress</span>
                              <span className="font-bold text-emerald-400">
                                {completedCount}/{totalCount} ({progressPct}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-dark-bg overflow-hidden border border-dark-border/30">
                              <div
                                className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Checklist Items List */}
                          <div className="pt-2 border-t border-dark-border/40 space-y-1.5">
                            <div className="flex items-center justify-between text-2xs">
                              <span className="font-bold text-slate-300 flex items-center gap-1">
                                <ListTodo className="w-3 h-3 text-cyan-400" />
                                <span>Checklist:</span>
                              </span>
                              {totalCount === 0 && (
                                <button
                                  onClick={() => handlePopulateStandardTemplate(app.id)}
                                  className="text-brand-300 hover:text-white font-semibold text-2xs"
                                  title="Add CV, Transcript, SOP, Recommendations template"
                                >
                                  + Standard Template
                                </button>
                              )}
                            </div>

                            <div className="max-h-36 overflow-y-auto space-y-1 text-2xs pr-1 scrollbar-thin">
                              {app.checklists.map((item) => (
                                <div
                                  key={item.id}
                                  className="group flex items-start justify-between gap-1 text-slate-300 hover:text-white transition p-1 rounded hover:bg-dark-bg/60"
                                >
                                  <div
                                    onClick={() => handleToggleChecklist(app.id, item.id)}
                                    className="flex items-start gap-1.5 cursor-pointer flex-1 min-w-0"
                                  >
                                    {item.isCompleted ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                    )}
                                    <span
                                      className={`text-[10.5px] leading-tight break-words ${
                                        item.isCompleted ? 'line-through text-slate-500' : ''
                                      }`}
                                    >
                                      {item.item}
                                    </span>
                                  </div>

                                  <button
                                    onClick={(e) => handleDeleteChecklistItem(app.id, item.id, e)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition shrink-0"
                                    title="Delete checklist item"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Add Task Input */}
                            <div className="flex gap-1 pt-1">
                              <input
                                type="text"
                                placeholder="Add custom requirement..."
                                value={newItemText[app.id] || ''}
                                onChange={(e) => setNewItemText({ ...newItemText, [app.id]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddChecklist(app.id);
                                  }
                                }}
                                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-2 py-1 text-2xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                              />
                              <button
                                onClick={() => handleAddChecklist(app.id)}
                                className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 text-2xs shrink-0"
                                title="Add Task"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Expandable Notes Section */}
                          <div className="pt-2 border-t border-dark-border/40">
                            <button
                              onClick={() => setOpenNotesMap((prev) => ({ ...prev, [app.id]: !prev[app.id] }))}
                              className="w-full flex items-center justify-between text-2xs font-semibold text-slate-400 hover:text-white transition"
                            >
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-brand-400" />
                                <span>Application Notes</span>
                              </span>
                              {isNotesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isNotesOpen && (
                              <div className="mt-2 space-y-1.5">
                                <textarea
                                  value={editingNotes[app.id] ?? ''}
                                  onChange={(e) => setEditingNotes({ ...editingNotes, [app.id]: e.target.value })}
                                  placeholder="Record contacts, professor outreach, interview remarks, or draft notes..."
                                  rows={2}
                                  className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-2xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                                />
                                <button
                                  onClick={() => handleSaveNotes(app.id)}
                                  className="px-2 py-1 rounded-md bg-dark-card border border-brand-500/40 text-brand-300 hover:bg-brand-600 hover:text-white text-2xs font-semibold flex items-center gap-1 transition"
                                >
                                  <Save className="w-2.5 h-2.5" />
                                  <span>Save Notes</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ApplicationsPage;
