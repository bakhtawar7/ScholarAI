import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../services/api';
import { PersonalisedScholarships, PersonalisedSection, Scholarship } from '../../types';
import { ScholarshipCard } from './ScholarshipCard';
import { SkeletonCard } from '../common/States';
import { Globe, Home, MapPin, Search, Loader2, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * The personalised scholarships view.
 *
 * Replaces a flat catalogue list as the default. Ranking by match score was already
 * happening, but with a small catalogue that only reorders the same rows — so the page read
 * as unpersonalised. Grouping by the student's relationship to each country states the
 * reasoning out loud, and makes an empty home-country section visible as a finding rather
 * than an absence at the bottom of a list.
 */

const SECTION_ICONS: Record<PersonalisedSection['key'], React.ElementType> = {
  home: Home,
  target: MapPin,
  international: Globe,
};

/**
 * Prompt to run a live search for a country with nothing in the catalogue.
 *
 * The seeded catalogue is entirely study-abroad destinations, so a student's own country
 * starts empty and no query will fill it — the records have to be discovered first. This is
 * the only place in the UI that spends a search quota on demand, so it is an explicit
 * button rather than something that fires on render.
 */
const DiscoverPrompt: React.FC<{
  country: string;
  onDiscovered: () => void;
}> = ({ country, onDiscovered }) => {
  const [state, setState] = useState<'idle' | 'searching' | 'done' | 'unavailable' | 'error'>('idle');
  const [detail, setDetail] = useState<string>('');

  const run = async () => {
    setState('searching');
    setDetail('');
    try {
      const res = await api.discoverScholarshipsForCountry({ country });

      if (!res.usedLiveExternalSearch) {
        // Not an error: every provider was out of quota. Say so plainly rather than
        // showing an empty result and letting the user assume none exist.
        setState('unavailable');
        setDetail(res.notices[0] || 'No search provider was available just now.');
        return;
      }

      if (res.created === 0 && res.updated === 0) {
        setState('done');
        setDetail(`The search ran but found no verifiable scholarships hosted in ${country}.`);
        return;
      }

      setState('done');
      setDetail(`Found ${res.created} new and updated ${res.updated} scholarship${res.updated === 1 ? '' : 's'}.`);
      onDiscovered();
    } catch (err) {
      setState('error');
      setDetail(
        err instanceof ApiError
          ? err.isRateLimited
            ? 'You have run several country searches recently. Please wait a few minutes.'
            : err.message
          : 'The search could not be started.'
      );
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-dark-card border border-dashed border-dark-border space-y-3">
      <div className="flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-slate-400 leading-relaxed">
          No scholarships hosted in <strong className="text-slate-200">{country}</strong> are in the catalogue yet. The
          seeded records are all study-abroad destinations — a live search of official sources can look for local ones.
        </p>
      </div>

      {state === 'idle' && (
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          Search for scholarships in {country}
        </button>
      )}

      {state === 'searching' && (
        <p className="flex items-center gap-2 text-xs text-slate-300" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" aria-hidden="true" />
          Searching official sources for {country}… this can take up to a minute.
        </p>
      )}

      {state === 'done' && (
        <p className="flex items-start gap-2 text-xs text-emerald-300" role="status">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{detail}</span>
        </p>
      )}

      {(state === 'unavailable' || state === 'error') && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-xs text-amber-300" role="status">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{detail}</span>
          </p>
          <button
            type="button"
            onClick={run}
            className="text-xs text-brand-300 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{
  section: PersonalisedSection;
  onToggleSave: (e: React.MouseEvent, s: Scholarship) => void;
  savingId: string | null;
  onDiscovered: () => void;
  onBrowseAll: (countries: string[]) => void;
}> = ({ section, onToggleSave, savingId, onDiscovered, onBrowseAll }) => {
  const Icon = SECTION_ICONS[section.key];
  const hidden = Math.max(0, section.total - section.items.length);

  return (
    <section className="space-y-3.5" aria-labelledby={`section-${section.key}`}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <h2 id={`section-${section.key}`} className="text-base font-bold text-white flex items-center gap-2">
            <Icon className="w-4 h-4 text-brand-400 shrink-0" aria-hidden="true" />
            <span>{section.title}</span>
            {section.total > 0 && (
              <span className="text-2xs font-semibold text-slate-400 bg-dark-card border border-dark-border rounded-full px-2 py-0.5">
                {section.total}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">{section.subtitle}</p>
        </div>

        {hidden > 0 && section.countries.length > 0 && (
          <button
            type="button"
            onClick={() => onBrowseAll(section.countries)}
            className="text-xs text-brand-300 font-semibold hover:underline shrink-0 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            View all {section.total} →
          </button>
        )}
      </div>

      {section.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {section.items.map((s) => (
            <ScholarshipCard key={s.id} scholarship={s} onToggleSave={onToggleSave} isSaving={savingId === s.id} />
          ))}
        </div>
      ) : section.discoverable && section.countries.length === 1 ? (
        <DiscoverPrompt country={section.countries[0]} onDiscovered={onDiscovered} />
      ) : (
        <p className="p-5 rounded-2xl bg-dark-card border border-dashed border-dark-border text-xs text-slate-400">
          Nothing here yet.{' '}
          {section.countries.length > 1
            ? `No scholarships in ${section.countries.join(', ')} are in the catalogue.`
            : 'Try the search and filters above.'}
        </p>
      )}
    </section>
  );
};

export const PersonalisedScholarshipsView: React.FC<{
  data: PersonalisedScholarships;
  loading: boolean;
  onToggleSave: (e: React.MouseEvent, s: Scholarship) => void;
  savingId: string | null;
  onRefresh: () => void;
  onBrowseCountries: (countries: string[]) => void;
}> = ({ data, loading, onToggleSave, savingId, onRefresh, onBrowseCountries }) => {
  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        <span className="sr-only">Loading your scholarship matches…</span>
        {[0, 1].map((s) => (
          <div key={s} className="space-y-3.5">
            <div className="h-4 w-48 bg-dark-hover rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {/* Profile gaps, stated once at the top with a route to fix them. */}
      {data.notices.length > 0 && (
        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-2">
          {data.notices.map((n) => (
            <p key={n} className="flex items-start gap-2 text-xs text-slate-300">
              <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{n}</span>
            </p>
          ))}
          <Link
            to="/profile"
            className="inline-block text-xs text-brand-300 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            Update your profile →
          </Link>
        </div>
      )}

      {data.sections.map((section) => (
        <Section
          key={section.key}
          section={section}
          onToggleSave={onToggleSave}
          savingId={savingId}
          onDiscovered={onRefresh}
          onBrowseAll={onBrowseCountries}
        />
      ))}
    </div>
  );
};
