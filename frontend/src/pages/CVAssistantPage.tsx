import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CVAnalysisResult } from '../types';
import {
  FileText,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Award,
  AlertCircle,
  BarChart3,
  BookOpen,
  GraduationCap,
  Briefcase,
  History,
  FileCheck,
  Check,
  X,
  RefreshCw,
  Clock,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Bot,
  Layers,
  Code2,
  FolderGit2,
} from 'lucide-react';

export const CVAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CVAnalysisResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  useEffect(() => {
    loadHistory();
    loadLatest();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getCVHistory();
      setHistory(data || []);
    } catch (err) {
      console.warn('Could not load CV history:', err);
    }
  };

  const loadLatest = async () => {
    try {
      const latest = await api.getLatestCV();
      if (latest && !analysis) {
        setAnalysis(latest);
      }
    } catch (err) {
      // No prior analysis or error, silent ignore
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selectedFile = e.target.files ? e.target.files[0] : null;
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate extension
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.txt') && !name.endsWith('.docx') && !name.endsWith('.doc')) {
      setError('Invalid file format. Please upload a PDF, DOCX, or TXT document.');
      setFile(null);
      return;
    }

    // Validate size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum allowed file size is 5MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSyncSuccess(null);

    if (activeTab === 'upload' && !file) {
      setError('Please select a CV document (PDF, DOCX, or TXT) to upload.');
      return;
    }

    if (activeTab === 'paste' && (!text || text.trim().length < 30)) {
      setError('Please enter at least 30 characters of your CV text.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      if (activeTab === 'upload' && file) {
        formData.append('file', file);
      } else {
        formData.append('text', text);
      }

      const res = await api.analyzeCV(formData);
      setAnalysis(res);
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'CV Analysis failed. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteCVAnalysis(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (analysis?.id === id) {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('Failed to delete CV analysis:', err);
    }
  };

  const handleSyncToProfile = async () => {
    if (!analysis?.extractedEntities?.skills && !analysis?.skillsFound) return;
    const skillsToSync = analysis.extractedEntities?.skills || analysis.skillsFound || [];
    if (skillsToSync.length === 0) return;

    setSyncing(true);
    setSyncSuccess(null);
    try {
      const res = await api.syncCVProfile({
        skills: skillsToSync,
        researchSummary: analysis.extractedEntities?.research?.join('; '),
      });
      setSyncSuccess(`Successfully synchronized ${skillsToSync.length} verified skills to your Student Profile!`);
      setTimeout(() => setSyncSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to synchronize skills with profile.');
    } finally {
      setSyncing(false);
    }
  };

  const getScoreRating = (score: number) => {
    if (score >= 85) return { label: 'Exceptional Alignment', color: 'text-emerald-400', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' };
    if (score >= 70) return { label: 'Strong Competitive', color: 'text-cyan-400', badge: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' };
    if (score >= 50) return { label: 'Needs Refinement', color: 'text-amber-400', badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300' };
    return { label: 'Critical Gaps', color: 'text-rose-400', badge: 'bg-rose-500/20 border-rose-500/30 text-rose-300' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400" />
            <span>AI CV Reviewer & Scholarship Alignment</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Extract academic credentials, verify clarity, identify missing details, and evaluate international scholarship readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3.5 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <History className="w-3.5 h-3.5 text-brand-400" />
              <span>{showHistory ? 'Hide History' : `Past Reviews (${history.length})`}</span>
            </button>
          )}

          <button
            onClick={() => navigate('/sop-assistant')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Go to SOP Assistant</span>
          </button>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="p-4 rounded-3xl glass-card border border-brand-500/30 space-y-3 animate-in fade-in text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Previous CV Evaluations</span>
            </span>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {history.map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={() => setAnalysis(item)}
                className="p-3 rounded-2xl bg-dark-bg/80 border border-dark-border hover:border-brand-500/50 cursor-pointer transition space-y-1 group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">{item.score} / 100</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 line-clamp-1">
                  Skills: {Array.isArray(item.skillsFound) ? item.skillsFound.slice(0, 3).join(', ') : 'Technical Skills'}
                </div>
                {item.id && (
                  <button
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                    className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                    title="Delete record"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Form Column (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border border-dark-border space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-400" />
              <span>Provide Curriculum Vitae</span>
            </h3>
            {/* Tab switch */}
            <div className="flex items-center p-1 rounded-xl bg-dark-bg border border-dark-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeTab === 'upload' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeTab === 'paste' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Paste Text
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {syncSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{syncSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAnalyze} className="space-y-4 text-xs">
            {activeTab === 'upload' ? (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-dark-border hover:border-brand-500/50 rounded-2xl p-6 text-center transition bg-dark-bg/40">
                  <Upload className="w-8 h-8 text-brand-400 mx-auto mb-2" />
                  <p className="font-bold text-white text-xs mb-1">
                    {file ? file.name : 'Choose a CV file or drag & drop here'}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Supported formats: PDF, DOCX, or TXT (Max size: 5MB)
                  </p>

                  <label className="inline-block px-4 py-2 rounded-xl bg-dark-card border border-brand-500/40 text-brand-300 hover:bg-brand-600 hover:text-white text-xs font-semibold cursor-pointer transition shadow-sm">
                    <span>{file ? 'Change Document' : 'Browse Files'}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {file && (
                  <div className="p-3 rounded-xl bg-dark-card/60 border border-dark-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-white truncate font-medium">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Paste Resume / CV Plain Text</label>
                <textarea
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your education history, degree details, research publications, capstone projects, internships, and technical competencies..."
                  className="w-full bg-dark-card border border-dark-border rounded-2xl p-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition leading-relaxed text-xs resize-none"
                ></textarea>
              </div>
            )}

            {/* Anti-Hallucination Verified Fact Guardrail Notice */}
            <div className="p-3 rounded-2xl bg-dark-bg/60 border border-dark-border/60 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Strict Fact Guardrail:</span>
              </span>
              <p>
                Our AI evaluator analyzes verified qualifications and provides objective feedback. It never invents, hallucinates, or exaggerates achievements.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || (activeTab === 'upload' && !file) || (activeTab === 'paste' && !text.trim())}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Extracting Credentials & Evaluating 9 Dimensions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Analyze CV for Scholarships</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {!analysis ? (
            <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-3 min-h-[440px] flex flex-col items-center justify-center shadow-xl">
              <Award className="w-12 h-12 text-slate-600" />
              <h3 className="text-base font-bold text-white">Academic CV Evaluation Dashboard</h3>
              <p className="text-xs max-w-sm mx-auto">
                Upload or paste your academic CV to inspect verified entities across education, skills, projects, research, clarity, and missing committee requirements.
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-3xl glass-panel border border-emerald-500/30 space-y-6 shadow-2xl animate-in fade-in">
              {/* Header & Overall Score */}
              <div className="flex items-center justify-between border-b border-dark-border pb-4 gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-white">CV Evaluation Report</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getScoreRating(analysis.score).badge}`}>
                      {getScoreRating(analysis.score).label}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400 mt-0.5">International Scholarship Academic Assessment</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="text-3xl font-black text-emerald-400">
                      {analysis.score} <span className="text-sm font-semibold text-slate-400">/ 100</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Overall Quality</div>
                  </div>
                </div>
              </div>

              {/* Scholarship Fit Summary */}
              {analysis.scholarshipFitSummary && (
                <div className="p-4 rounded-2xl bg-dark-bg/80 border border-brand-500/30 text-xs text-slate-200 leading-relaxed">
                  <strong className="text-cyan-300 block mb-1">Scholarship Fit Summary:</strong>
                  {analysis.scholarshipFitSummary}
                </div>
              )}

              {/* Dimension Scores Breakdown */}
              {analysis.dimensionScores && (
                <div className="space-y-2.5 text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-brand-400" />
                    <span>Dimension Quality Breakdown (9 Key Areas):</span>
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(analysis.dimensionScores).map(([key, val]: [string, any]) => (
                      <div key={key} className="p-3 rounded-2xl bg-dark-card/80 border border-dark-border space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <strong className="text-white font-bold">{val}%</strong>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-dark-bg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full"
                            style={{ width: `${val}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Verified Entities */}
              {analysis.extractedEntities && (
                <div className="space-y-3 text-xs pt-2 border-t border-dark-border">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-400" />
                      <span>Extracted Credentials & Verified Entities:</span>
                    </span>

                    {/* Sync to Profile Button */}
                    {analysis.extractedEntities.skills?.length > 0 && (
                      <button
                        onClick={handleSyncToProfile}
                        disabled={syncing}
                        className="px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 hover:text-white border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold flex items-center gap-1.5 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                        <span>Sync Skills to My Profile</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Education */}
                    {analysis.extractedEntities.education?.length > 0 && (
                      <div className="p-3 rounded-2xl bg-dark-card/60 border border-dark-border space-y-1">
                        <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5" /> Education Found:
                        </span>
                        <ul className="space-y-0.5 text-slate-300 text-[11px]">
                          {analysis.extractedEntities.education.map((e, idx) => (
                            <li key={idx}>• {e}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Experience */}
                    {analysis.extractedEntities.experience && analysis.extractedEntities.experience.length > 0 && (
                      <div className="p-3 rounded-2xl bg-dark-card/60 border border-dark-border space-y-1">
                        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" /> Experience & Roles:
                        </span>
                        <ul className="space-y-0.5 text-slate-300 text-[11px]">
                          {analysis.extractedEntities.experience.map((exp, idx) => (
                            <li key={idx}>• {exp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Projects */}
                    {analysis.extractedEntities.projects && analysis.extractedEntities.projects.length > 0 && (
                      <div className="p-3 rounded-2xl bg-dark-card/60 border border-dark-border space-y-1">
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                          <FolderGit2 className="w-3.5 h-3.5" /> Projects & Capstones:
                        </span>
                        <ul className="space-y-0.5 text-slate-300 text-[11px]">
                          {analysis.extractedEntities.projects.map((proj, idx) => (
                            <li key={idx}>• {proj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Research */}
                    {analysis.extractedEntities.research && analysis.extractedEntities.research.length > 0 && (
                      <div className="p-3 rounded-2xl bg-dark-card/60 border border-dark-border space-y-1">
                        <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" /> Research & Publications:
                        </span>
                        <ul className="space-y-0.5 text-slate-300 text-[11px]">
                          {analysis.extractedEntities.research.map((res, idx) => (
                            <li key={idx}>• {res}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Skills badges */}
                  {analysis.extractedEntities.skills?.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">Verified Skills Extracted:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.extractedEntities.skills.map((s: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Achievements */}
                  {analysis.extractedEntities.achievements && analysis.extractedEntities.achievements.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Honors & Achievements (Verified):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.extractedEntities.achievements.map((a: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                            🏆 {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dark-border text-xs">
                {/* Strengths */}
                <div className="space-y-2">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Key Strengths:
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {(analysis.strengths || []).map((str: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="space-y-2">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Areas for Improvement:
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {(analysis.weaknesses || []).map((w: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Missing Information Alert Box */}
              {analysis.missingInformation && analysis.missingInformation.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2">
                  <span className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Critical Missing Information & Committee Gaps:</span>
                  </span>
                  <ul className="space-y-1 text-rose-200/90 pl-1">
                    {analysis.missingInformation.map((m: string, idx: number) => (
                      <li key={idx}>⚠️ {m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actionable Recommendations */}
              <div className="space-y-2 text-xs pt-2 border-t border-dark-border">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> Actionable Formatting & Content Recommendations:
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {(analysis.suggestions || []).map((s: string, idx: number) => (
                    <li key={idx} className="p-2 rounded-xl bg-dark-card/60 border border-dark-border text-slate-200">
                      💡 {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer Call to Action */}
              <div className="flex items-center justify-between pt-4 border-t border-dark-border text-xs">
                <button
                  onClick={() => navigate('/ai-assistant')}
                  className="px-4 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-slate-300 hover:text-white font-semibold flex items-center gap-1.5 transition"
                >
                  <Bot className="w-3.5 h-3.5 text-brand-400" />
                  <span>Discuss in AI Assistant</span>
                </button>

                <button
                  onClick={() => navigate('/sop-assistant')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold flex items-center gap-1.5 transition shadow-md"
                >
                  <span>Build SOP from Extracted Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CVAssistantPage;
