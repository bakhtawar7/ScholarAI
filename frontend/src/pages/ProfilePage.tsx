import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { InlineError } from '../components/common/States';
import { useAuth } from '../context/AuthContext';
import { UserCheck, Save, GraduationCap, Globe, BookOpen, Award } from 'lucide-react';

/**
 * Renders a profile list column as a comma-separated string.
 *
 * Accepts an array (the documented shape) or a raw JSON string, because SQLite stores
 * these as TEXT and a serialization gap would otherwise crash the page on `.join`.
 */
function toCsv(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.join(', ') : value;
    } catch {
      return value;
    }
  }
  return '';
}

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    fullName: '',
    countryOfResidence: '',
    nationality: '',
    currentDegreeLevel: 'BACHELORS',
    currentDegreeName: '',
    fieldOfStudy: '',
    university: '',
    gpa: '3.65',
    maxGpa: '4.0',
    graduationYear: '2025',
    targetDegreeLevel: 'MASTERS',
    targetCountriesStr: 'Germany, United Kingdom, Switzerland, Japan, United States',
    preferredFieldsStr: 'Computer Science, Artificial Intelligence, Data Science, Software Engineering',
    ieltsScore: '7.5',
    toeflScore: '105',
    financialPreference: 'Full Funding Required',
    scholarshipPreference: 'Merit-Based International Scholarships',
    skillsStr: 'Python, TypeScript, Machine Learning, React, Node.js, PyTorch',
    workExperienceYears: '1.5',
    researchExperience:
      'Co-authored a paper on Transformer Optimization for Edge Devices presented at IEEE student symposium.',
  });

  useEffect(() => {
    if (user?.profile) {
      const p = user.profile;
      const lang: Record<string, any> =
        typeof p.languageTests === 'string'
          ? (() => {
              try {
                return JSON.parse(p.languageTests) || {};
              } catch {
                return {};
              }
            })()
          : p.languageTests || {};
      setFormData({
        fullName: p.fullName || '',
        countryOfResidence: p.countryOfResidence || '',
        nationality: p.nationality || '',
        currentDegreeLevel: p.currentDegreeLevel || 'BACHELORS',
        currentDegreeName: p.currentDegreeName || '',
        fieldOfStudy: p.fieldOfStudy || '',
        university: p.university || '',
        gpa: p.gpa ? p.gpa.toString() : '',
        maxGpa: p.maxGpa ? p.maxGpa.toString() : '4.0',
        graduationYear: p.graduationYear ? p.graduationYear.toString() : '',
        targetDegreeLevel: p.targetDegreeLevel || 'MASTERS',
        targetCountriesStr: toCsv(p.targetCountries),
        preferredFieldsStr: toCsv(p.preferredFields),
        ieltsScore: lang.IELTS?.toString() || '',
        toeflScore: lang.TOEFL?.toString() || '',
        financialPreference: p.financialPreference || '',
        scholarshipPreference: p.scholarshipPreference || '',
        skillsStr: toCsv(p.skills),
        workExperienceYears: p.workExperienceYears?.toString() || '0',
        researchExperience: p.researchExperience || '',
      });
    }
  }, [user]);

  // Drives the adaptive labelling below: a school leaver reports intermediate marks,
  // not a degree GPA.
  const isSchoolLeaver = formData.currentDegreeLevel === 'HIGH_SCHOOL';
  const isPercentageScale = parseFloat(formData.maxGpa) > 20;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';

    // Mirrors the backend profileValidator ranges so bad input is caught before the
    // request, and a NaN can never reach Prisma.
    const gpa = parseFloat(formData.gpa);
    const maxGpa = parseFloat(formData.maxGpa);
    if (formData.gpa && !Number.isFinite(gpa)) errs.gpa = 'GPA must be a number';
    else if (formData.gpa && (gpa < 0 || gpa > 100)) errs.gpa = 'GPA must be between 0 and 100';

    if (formData.maxGpa && !Number.isFinite(maxGpa)) errs.maxGpa = 'GPA scale must be a number';
    else if (formData.maxGpa && (maxGpa < 1 || maxGpa > 100)) errs.maxGpa = 'GPA scale must be between 1 and 100';
    else if (Number.isFinite(gpa) && Number.isFinite(maxGpa) && gpa > maxGpa)
      errs.gpa = 'GPA cannot exceed your GPA scale';

    if (formData.graduationYear) {
      const year = parseInt(formData.graduationYear, 10);
      if (!Number.isFinite(year) || year < 1950 || year > 2100)
        errs.graduationYear = 'Enter a graduation year between 1950 and 2100';
    }

    const ielts = parseFloat(formData.ieltsScore);
    if (formData.ieltsScore && (!Number.isFinite(ielts) || ielts < 0 || ielts > 9))
      errs.ieltsScore = 'IELTS must be between 0 and 9';

    const toefl = parseFloat(formData.toeflScore);
    if (formData.toeflScore && (!Number.isFinite(toefl) || toefl < 0 || toefl > 120))
      errs.toeflScore = 'TOEFL must be between 0 and 120';

    const years = parseFloat(formData.workExperienceYears);
    if (formData.workExperienceYears && (!Number.isFinite(years) || years < 0 || years > 70))
      errs.workExperienceYears = 'Work experience must be between 0 and 70 years';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavedSuccess(false);
    if (!validate()) return;

    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName,
        countryOfResidence: formData.countryOfResidence,
        nationality: formData.nationality,
        currentDegreeLevel: formData.currentDegreeLevel,
        currentDegreeName: formData.currentDegreeName,
        fieldOfStudy: formData.fieldOfStudy,
        university: formData.university,
        gpa: formData.gpa,
        maxGpa: formData.maxGpa,
        graduationYear: formData.graduationYear,
        targetDegreeLevel: formData.targetDegreeLevel,
        targetCountries: formData.targetCountriesStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredFields: formData.preferredFieldsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        languageTests: Object.fromEntries(
          [
            ['IELTS', formData.ieltsScore ? parseFloat(formData.ieltsScore) : null],
            ['TOEFL', formData.toeflScore ? parseFloat(formData.toeflScore) : null],
          ].filter(([, v]) => v !== null)
        ),
        financialPreference: formData.financialPreference,
        scholarshipPreference: formData.scholarshipPreference,
        skills: formData.skillsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        workExperienceYears: formData.workExperienceYears,
        researchExperience: formData.researchExperience,
      };

      await api.updateProfile(payload);
      await refreshUser();
      setSavedSuccess(true);
    } catch (err) {
      // Previously the save silently failed and the form looked unchanged.
      if (err instanceof ApiError) {
        if (err.details?.length) {
          const mapped: Record<string, string> = {};
          err.details.forEach((d) => {
            if (d.field) mapped[d.field] = d.message;
          });
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
        }
        setSaveError(err.message);
      } else {
        setSaveError('Could not save your profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-brand-400" />
          <span>Academic Profile & Preferences</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Keep your academic parameters up to date. The AI Matching Engine uses this profile to compute compatibility
          scores.
        </p>
      </div>

      {savedSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between"
        >
          <span>Profile saved. AI scholarship compatibility scores are being recalculated.</span>
        </div>
      )}

      {saveError && <InlineError message={saveError} onDismiss={() => setSaveError(null)} />}

      {Object.keys(fieldErrors).length > 0 && (
        <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <p className="font-semibold mb-1">Please correct the following:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Basic Personal Info */}
        <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Personal & Demographics</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Country of Residence</label>
              <input
                type="text"
                required
                value={formData.countryOfResidence}
                onChange={(e) => setFormData({ ...formData, countryOfResidence: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nationality</label>
              <input
                type="text"
                required
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Current Academic Status */}
        <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-400" />
            <span>Current Education & Performance</span>
          </h3>

          {/* School-leaving applicants (intermediate / grade 12) report percentage marks,
              not a 4.0 GPA. The grading-scale selector sets maxGpa, and the matching engine
              already normalises (gpa / maxGpa) against each scholarship's own scale — so
              85/100 and 3.4/4.0 compare correctly. */}
          {isSchoolLeaver && (
            <p className="p-3 rounded-xl bg-brand-900/40 border border-brand-500/30 text-brand-200 text-2xs leading-relaxed">
              Applying straight from school or college? Choose <strong>Percentage</strong> as your grading scale and
              enter your intermediate / grade&nbsp;12 marks — for example <strong>85</strong> out of{' '}
              <strong>100</strong>.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="current-level" className="block text-slate-300 font-semibold mb-1">
                Current Education Level
              </label>
              <select
                id="current-level"
                value={formData.currentDegreeLevel}
                onChange={(e) => setFormData({ ...formData, currentDegreeLevel: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="HIGH_SCHOOL">High School / Intermediate (Grade 12)</option>
                <option value="BACHELORS">Bachelor&apos;s Degree</option>
                <option value="MASTERS">Master&apos;s Degree</option>
                <option value="PHD">PhD / Doctorate</option>
              </select>
            </div>
            <div>
              <label htmlFor="current-title" className="block text-slate-300 font-semibold mb-1">
                {isSchoolLeaver ? 'Certificate / Board' : 'Current Degree Title'}
              </label>
              <input
                id="current-title"
                type="text"
                value={formData.currentDegreeName}
                onChange={(e) => setFormData({ ...formData, currentDegreeName: e.target.value })}
                placeholder={isSchoolLeaver ? 'e.g. FSc Pre-Engineering / A-Levels' : 'e.g. B.S. Computer Science'}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label htmlFor="field-of-study" className="block text-slate-300 font-semibold mb-1">
                {isSchoolLeaver ? 'Stream / Subjects' : 'Field of Study'}
              </label>
              {/* Bug fix: this input previously wrote to `university`, so Field of Study
                  never saved and silently overwrote the university name. */}
              <input
                id="field-of-study"
                type="text"
                value={formData.fieldOfStudy}
                onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                placeholder={isSchoolLeaver ? 'e.g. Pre-Engineering' : 'e.g. Computer Science'}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label htmlFor="grading-scale" className="block text-slate-300 font-semibold mb-1">
                Grading Scale
              </label>
              <select
                id="grading-scale"
                value={formData.maxGpa}
                onChange={(e) => setFormData({ ...formData, maxGpa: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="4.0">GPA out of 4.0</option>
                <option value="5.0">GPA out of 5.0</option>
                <option value="10.0">CGPA out of 10.0</option>
                <option value="20.0">Grade out of 20</option>
                <option value="100">Percentage (out of 100)</option>
              </select>
            </div>
            <div>
              <label htmlFor="gpa" className="block text-slate-300 font-semibold mb-1">
                {isPercentageScale ? 'Marks Obtained (%)' : 'GPA / CGPA'}
              </label>
              <input
                id="gpa"
                type="number"
                step={isPercentageScale ? '0.1' : '0.01'}
                min="0"
                max={formData.maxGpa || '100'}
                value={formData.gpa}
                onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                aria-describedby="gpa-hint"
                placeholder={isPercentageScale ? '85' : '3.65'}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
              />
              <p id="gpa-hint" className="text-2xs text-slate-500 mt-1">
                out of {formData.maxGpa || '4.0'}
              </p>
            </div>
            <div>
              <label htmlFor="grad-year" className="block text-slate-300 font-semibold mb-1">
                {isSchoolLeaver ? 'Year Completed / Expected' : 'Graduation Year'}
              </label>
              <input
                id="grad-year"
                type="number"
                min="1950"
                max="2100"
                value={formData.graduationYear}
                onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                placeholder="2026"
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Target Goals & Language Scores */}
        <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Target Goals & Language Tests</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Degree Level</label>
              <select
                value={formData.targetDegreeLevel}
                onChange={(e) => setFormData({ ...formData, targetDegreeLevel: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              >
                <option value="MASTERS">Master's Degree</option>
                <option value="PHD">PhD / Doctorate</option>
                <option value="BACHELORS">Bachelor's Degree</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Countries (comma separated)</label>
              <input
                type="text"
                value={formData.targetCountriesStr}
                onChange={(e) => setFormData({ ...formData, targetCountriesStr: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Preferred Fields of Study</label>
              <input
                type="text"
                value={formData.preferredFieldsStr}
                onChange={(e) => setFormData({ ...formData, preferredFieldsStr: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">IELTS Overall Score</label>
              <input
                type="number"
                step="0.5"
                value={formData.ieltsScore}
                onChange={(e) => setFormData({ ...formData, ieltsScore: e.target.value })}
                placeholder="7.5"
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">TOEFL Score</label>
              <input
                type="number"
                value={formData.toeflScore}
                onChange={(e) => setFormData({ ...formData, toeflScore: e.target.value })}
                placeholder="105"
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Skills & Experience */}
        <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Skills & Research Background</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Key Skills (comma separated)</label>
              <input
                type="text"
                value={formData.skillsStr}
                onChange={(e) => setFormData({ ...formData, skillsStr: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Research & Academic Experience Summary</label>
              <textarea
                rows={3}
                value={formData.researchExperience}
                onChange={(e) => setFormData({ ...formData, researchExperience: e.target.value })}
                className="w-full bg-dark-card border border-dark-border rounded-xl p-3 text-white leading-relaxed"
              ></textarea>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-2 transition"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Saving & Re-matching...' : 'Save & Trigger AI Matching'}</span>
        </button>
      </form>
    </div>
  );
};
