import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { Scholarship, ScholarshipFilterFacets } from '../types';
import { ScholarshipCard } from '../components/scholarships/ScholarshipCard';
import { ScholarshipFilters, FilterState } from '../components/scholarships/ScholarshipFilters';
import { ErrorState, EmptyState, InlineError, SkeletonCard } from '../components/common/States';
import { GraduationCap, ChevronLeft, ChevronRight, Info, SearchX, Bookmark } from 'lucide-react';

const INITIAL_FILTERS: FilterState = {
  q: '',
  country: '',
  degreeLevel: '',
  field: '',
  fundingType: '',
  deadline: 'upcoming',
  nationality: '',
  language: '',
  minGpa: '',
  verificationStatus: '',
  sortBy: 'match',
};

/**
 * Builds a windowed page list with ellipses.
 * Rendering one button per page produced 80+ buttons on a large catalogue and broke
 * the toolbar layout entirely.
 */
function buildPageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: Array<number | 'gap'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('gap');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('gap');
  pages.push(total);

  return pages;
}

export const ScholarshipsPage: React.FC = () => {
  const location = useLocation();
  const isSavedView = location.pathname === '/saved';

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [facets, setFacets] = useState<ScholarshipFilterFacets | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isSavedView) {
        const savedItems = await api.getSaved();
        const formattedSaved = (Array.isArray(savedItems) ? savedItems : [])
          .filter((item: any) => item?.scholarship)
          .map((item: any) => ({ ...item.scholarship, isSaved: true }));
        setScholarships(formattedSaved);
        setTotal(formattedSaved.length);
        setTotalPages(1);
      } else {
        const res = await api.searchScholarships({ ...filters, page, limit });
        setScholarships(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.availableFilters) setFacets(res.availableFilters);
      }
    } catch (err) {
      // Distinguish failure from "no results" — showing the empty state on a failed
      // request told the user their data did not exist.
      setLoadError(err instanceof ApiError ? err.message : 'Could not load scholarships.');
      setScholarships([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit, isSavedView]);

  useEffect(() => {
    void fetchScholarships();
  }, [fetchScholarships]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleToggleSave = async (e: React.MouseEvent, s: Scholarship) => {
    e.stopPropagation();
    setSavingId(s.id);
    setActionError(null);
    try {
      if (s.isSaved) {
        await api.removeSaved(s.id);
        if (isSavedView) {
          // On the saved view an unsaved card must leave the list, not linger unsaved.
          setScholarships((prev) => prev.filter((item) => item.id !== s.id));
          setTotal((t) => Math.max(0, t - 1));
        } else {
          setScholarships((prev) => prev.map((item) => (item.id === s.id ? { ...item, isSaved: false } : item)));
        }
      } else {
        await api.saveScholarship(s.id);
        setScholarships((prev) => prev.map((item) => (item.id === s.id ? { ...item, isSaved: true } : item)));
      }
    } catch (err) {
      setActionError(
        err instanceof ApiError ? `Could not update saved list: ${err.message}` : 'Could not update saved list.'
      );
    } finally {
      setSavingId(null);
    }
  };

  const pageWindow = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
              {isSavedView ? (
                <Bookmark className="w-5 h-5 text-white" aria-hidden="true" />
              ) : (
                <GraduationCap className="w-5 h-5 text-white" aria-hidden="true" />
              )}
            </span>
            <span>{isSavedView ? 'Saved Scholarships' : 'Scholarship Explorer'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isSavedView
              ? 'Your bookmarked international scholarships and target funding opportunities.'
              : 'Discover verified international scholarships, analyse match compatibility, and track application deadlines.'}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shrink-0">
          <Info className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            Seeded records are labelled <strong>DEMO DATA</strong>.
          </span>
        </div>
      </div>

      {!isSavedView && (
        <ScholarshipFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          facets={facets}
          totalResults={total}
          loading={loading}
        />
      )}

      {actionError && <InlineError message={actionError} onDismiss={() => setActionError(null)} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
          <span className="sr-only">Loading scholarships…</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          title="Could not load scholarships"
          message={loadError}
          onRetry={() => void fetchScholarships()}
        />
      ) : scholarships.length === 0 ? (
        <EmptyState
          icon={isSavedView ? <Bookmark className="w-6 h-6" /> : <SearchX className="w-6 h-6" />}
          title={isSavedView ? 'No saved scholarships yet' : 'No scholarships matched your criteria'}
          message={
            isSavedView
              ? 'Browse the Scholarship Explorer and bookmark opportunities to monitor them here.'
              : 'Try removing some filter restrictions (country, funding type, or deadline) or adjusting your search keywords.'
          }
          action={
            isSavedView ? (
              <Link
                to="/scholarships"
                className="inline-block px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
              >
                Explore scholarships
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
              >
                Reset all filters
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {scholarships.map((s) => (
              <ScholarshipCard
                key={s.id}
                scholarship={s}
                onToggleSave={handleToggleSave}
                isSaving={savingId === s.id}
              />
            ))}
          </div>

          {!isSavedView && (
            <nav
              aria-label="Pagination"
              className="p-4 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            >
              <p className="text-slate-400 font-medium" aria-live="polite">
                Showing <strong className="text-white">{rangeStart}</strong> to{' '}
                <strong className="text-white">{rangeEnd}</strong> of{' '}
                <strong className="text-white">{total}</strong> opportunities
              </p>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <label htmlFor="per-page">Per page:</label>
                  <select
                    id="per-page"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-dark-card border border-dark-border rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                  >
                    {[6, 12, 24, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-dark-border bg-dark-card text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>

                  {pageWindow.map((entry, idx) =>
                    entry === 'gap' ? (
                      <span key={`gap-${idx}`} className="px-1 text-slate-600" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => setPage(entry)}
                        aria-current={page === entry ? 'page' : undefined}
                        aria-label={`Page ${entry}`}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${
                          page === entry
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                            : 'bg-dark-card border border-dark-border text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        {entry}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-dark-border bg-dark-card text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
};
