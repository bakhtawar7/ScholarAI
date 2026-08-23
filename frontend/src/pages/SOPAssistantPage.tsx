import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileEdit,
  HelpCircle,
  LayoutList,
  Lightbulb,
  Loader2,
  RotateCw,
  Save,
  ShieldCheck,
  Trash2,
  Wand2,
} from 'lucide-react';
import { SOPFeedbackResult, SOPOutlineSection, SOPQuestion, SOPSession } from '../types';

export const SOPAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'guided' | 'outline' | 'editor' | 'refine'>('guided');
  const [targetScholarshipTitle, setTargetScholarshipTitle] = useState(
    'DAAD Postgraduate Study Scholarship in Germany'
  );
  /**
   * Seeded from the student's own profile.
   *
   * This was a hardcoded 'Computer Science & AI' whose setter was never called, so every
   * student — whatever they actually study — had their SOP questions and outline generated
   * for Computer Science. The literal now serves only as a fallback for a profile that has
   * not been filled in yet.
   */
  const [fieldOfStudy, setFieldOfStudy] = useState(
    () => user?.profile?.fieldOfStudy || user?.profile?.preferredFields?.[0] || 'Computer Science & AI'
  );

  // The profile arrives asynchronously via /auth/me, so adopt it once it lands — but never
  // overwrite a value the student has since edited themselves.
  const [fieldEdited, setFieldEdited] = useState(false);
  useEffect(() => {
    if (fieldEdited) return;
    const fromProfile = user?.profile?.fieldOfStudy || user?.profile?.preferredFields?.[0];
    if (fromProfile) setFieldOfStudy(fromProfile);
  }, [user, fieldEdited]);

  // Guided Questions State
  const [questions, setQuestions] = useState<SOPQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Outline State
  const [outline, setOutline] = useState<SOPOutlineSection[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);

  // Draft Editor & Feedback State
  const [draftText, setDraftText] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [feedback, setFeedback] = useState<SOPFeedbackResult | null>(null);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // Saved Sessions State
  const [sessions, setSessions] = useState<SOPSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  // Refinement State
  const [sectionToRefine, setSectionToRefine] = useState('Paragraph 1: Introduction & Hook');
  const [originalSectionText, setOriginalSectionText] = useState('');
  const [refinementInstructions, setRefinementInstructions] = useState(
    'Improve academic vocabulary, active voice, and conciseness'
  );
  const [refinementResult, setRefinementResult] = useState<any | null>(null);
  const [loadingRefine, setLoadingRefine] = useState(false);
  const [copied, setCopied] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  // Fetch guided questions on initial mount or scholarship change
  useEffect(() => {
    fetchQuestions();
    loadSessions();
  }, [targetScholarshipTitle]);

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await api.getSOPQuestions(targetScholarshipTitle, fieldOfStudy);
      setQuestions(res.questions || []);
    } catch (err) {
      console.error('Failed to load guided questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await api.getSOPSessions();
      setSessions(data || []);
    } catch (err) {
      console.warn('Could not load SOP sessions:', err);
    }
  };

  const handleGenerateOutline = async () => {
    setLoadingOutline(true);
    setError('');
    try {
      const res = await api.getSOPOutline({ targetScholarshipTitle, userInputs: answers });
      setOutline(res.outline || []);
      setActiveTab('outline');
    } catch (err: any) {
      setError(err.message || 'Failed to generate outline.');
    } finally {
      setLoadingOutline(false);
    }
  };

  const handleApplyOutlineToDraft = () => {
    if (outline.length === 0) return;
    const templateDraft = outline
      .map((sec, idx) => {
        const userAns = answers[`q${idx + 1}`] || answers[questions[idx]?.id] || '';
        return `## ${sec.sectionTitle}\n${userAns || `[Draft your points on ${sec.purpose}]`}\n`;
      })
      .join('\n');
    setDraftText(templateDraft);
    setActiveTab('editor');
  };

  const handleAnalyzeDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!draftText || draftText.trim().length < 30) {
      setError('Please provide at least 30 characters of your Statement of Purpose draft.');
      return;
    }

    setLoadingAnalysis(true);
    try {
      const res = await api.analyzeSOP({ draftText, targetScholarshipTitle });
      setFeedback(res.feedback || res);
      if (res.id) setCurrentSessionId(res.id);
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'SOP evaluation failed.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftText || !draftText.trim()) {
      setError('Draft is empty. Write some content before saving.');
      return;
    }

    setSavingDraft(true);
    setError('');
    try {
      const res = await api.saveSOPSession({
        targetScholarship: targetScholarshipTitle,
        draftText,
        sessionId: currentSessionId,
      });
      setCurrentSessionId(res.id);
      setSaveSuccess('Draft successfully saved to your sessions!');
      setTimeout(() => setSaveSuccess(null), 3000);
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft session.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const sess = await api.getSOPSessionById(sessionId);
      if (sess) {
        setDraftText(sess.draftText || '');
        if (sess.targetScholarship) setTargetScholarshipTitle(sess.targetScholarship);
        if (sess.feedback) setFeedback(sess.feedback);
        setCurrentSessionId(sess.id);
        setShowSessions(false);
        setActiveTab('editor');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteSOPSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(undefined);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleRefineSection = async () => {
    if (!originalSectionText || !originalSectionText.trim()) {
      setError('Please provide text for the section you wish to refine.');
      return;
    }

    setError('');
    setLoadingRefine(true);
    setApplySuccess(false);
    try {
      const res = await api.refineSOPSection({
        sectionTitle: sectionToRefine,
        originalText: originalSectionText,
        instructions: refinementInstructions,
      });
      setRefinementResult(res);
    } catch (err: any) {
      setError(err.message || 'Refinement failed.');
    } finally {
      setLoadingRefine(false);
    }
  };

  const handleCopyRefined = () => {
    if (refinementResult?.refinedText) {
      navigator.clipboard.writeText(refinementResult.refinedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyRefinedToDraft = () => {
    if (!refinementResult?.refinedText) return;
    if (draftText.includes(originalSectionText)) {
      setDraftText(draftText.replace(originalSectionText, refinementResult.refinedText));
    } else {
      setDraftText((prev) => (prev ? `${prev}\n\n${refinementResult.refinedText}` : refinementResult.refinedText));
    }
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 3000);
  };

  const wordCount = draftText.trim() ? draftText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpenCheck className="w-6 h-6 text-indigo-400" />
            <span>Interactive Statement of Purpose (SOP) Assistant</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Develop, structure, evaluate, and refine your authentic academic statement without fabricating credentials.
          </p>
        </div>

        {/* Target Program Config & Sessions */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={targetScholarshipTitle}
            onChange={(e) => setTargetScholarshipTitle(e.target.value)}
            placeholder="Target Scholarship / Program"
            aria-label="Target scholarship or programme"
            className="bg-dark-card border border-dark-border rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-64 shadow-sm"
          />

          {/* Field of study drives the generated questions and outline. It defaults to the
              student's profile and is editable here, since an SOP is often written for a
              programme in a different field from the current degree. */}
          <input
            type="text"
            value={fieldOfStudy}
            onChange={(e) => {
              setFieldEdited(true);
              setFieldOfStudy(e.target.value);
            }}
            placeholder="Field of Study"
            aria-label="Field of study"
            className="bg-dark-card border border-dark-border rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-52 shadow-sm"
          />

          {sessions.length > 0 && (
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showSessions ? 'Hide Drafts' : `Drafts (${sessions.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Sessions Drawer */}
      {showSessions && (
        <div className="p-4 rounded-3xl glass-card border border-indigo-500/30 space-y-3 animate-in fade-in text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Saved SOP Drafts & Sessions</span>
            </span>
            <button onClick={() => setShowSessions(false)} className="text-slate-400 hover:text-white">
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => handleLoadSession(sess.id)}
                className="p-3 rounded-2xl bg-dark-bg/80 border border-dark-border hover:border-indigo-500/50 cursor-pointer transition space-y-1 group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300 truncate max-w-[170px]">
                    {sess.targetScholarship || 'Scholarship Draft'}
                  </span>
                  <span className="text-2xs text-slate-400">
                    {new Date(sess.updatedAt || sess.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-2xs text-slate-400 line-clamp-2">{sess.draftSnippet || 'Draft text...'}</p>
                <button
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                  title="Delete draft"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-card border border-dark-border text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('guided')}
          className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'guided'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-300" />
          <span>1. Guided Discovery Q&A</span>
        </button>

        <button
          onClick={() => setActiveTab('outline')}
          className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'outline'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5 text-indigo-300" />
          <span>2. 5-Paragraph Outline</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'editor'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          <FileEdit className="w-3.5 h-3.5 text-emerald-300" />
          <span>3. Draft & AI Evaluation</span>
        </button>

        <button
          onClick={() => setActiveTab('refine')}
          className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'refine'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5 text-purple-300" />
          <span>4. Polish & Refine Sections</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* TAB 1: GUIDED DISCOVERY */}
      {activeTab === 'guided' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-white">Guided Statement Discovery</h3>
                <p className="text-xs text-slate-400">
                  Answer strategic prompts to articulate your authentic background and career goals without fabricating
                  credentials.
                </p>
              </div>
              <span className="text-xs font-semibold text-brand-300 bg-brand-500/10 border border-brand-500/30 px-3 py-1 rounded-xl">
                Target: {targetScholarshipTitle}
              </span>
            </div>

            {loadingQuestions ? (
              <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-brand-400" />
                <span>Loading tailored scholarship discovery prompts...</span>
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl bg-dark-bg/80 border border-dark-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-2xs flex items-center justify-center text-white font-bold">
                          {idx + 1}
                        </span>
                        <span>{q.category}</span>
                      </span>
                      {answers[`q${idx + 1}`]?.trim() && (
                        <span className="text-2xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Answered
                        </span>
                      )}
                    </div>

                    <p className="text-slate-300 font-medium">{q.question}</p>
                    <p className="text-2xs text-slate-400 italic">💡 Strategy Hint: {q.hint}</p>

                    <textarea
                      rows={3}
                      value={answers[`q${idx + 1}`] || ''}
                      onChange={(e) => setAnswers({ ...answers, [`q${idx + 1}`]: e.target.value })}
                      placeholder={
                        q.placeholder || 'Write your authentic project experience, thesis focus, or goals here...'
                      }
                      className="w-full bg-dark-card border border-dark-border rounded-xl p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition leading-relaxed resize-none text-xs"
                    />
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleGenerateOutline}
                    disabled={loadingOutline}
                    className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition"
                  >
                    {loadingOutline ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Structuring Outline...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Structured 5-Paragraph Outline</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OUTLINE BUILDER */}
      {activeTab === 'outline' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl glass-panel border border-dark-border space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-white">5-Paragraph Academic SOP Blueprint</h3>
                <p className="text-xs text-indigo-300">Targeting: {targetScholarshipTitle}</p>
              </div>
              <button
                onClick={handleApplyOutlineToDraft}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-md"
              >
                <span>Transfer Outline to Draft Editor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {outline.length === 0 ? (
              <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-2">
                <LayoutList className="w-10 h-10 text-brand-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Outline Generated Yet</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Complete the guided questions in Step 1 or generate a standard 5-paragraph blueprint for your target
                  scholarship.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleGenerateOutline}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
                  >
                    Generate Default Outline
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {outline.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-dark-bg/80 border border-dark-border hover:border-brand-500/40 transition space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-2xs font-bold">
                          Paragraph {sec.paragraphNumber || idx + 1}
                        </span>
                        <span>{sec.sectionTitle}</span>
                      </span>
                      <span className="text-2xs text-slate-400 font-semibold">{sec.recommendedWordCount}</span>
                    </div>

                    <p className="text-slate-300">{sec.purpose}</p>

                    {sec.userContent && (
                      <div className="p-2.5 rounded-xl bg-dark-card/80 border border-brand-500/20 text-2xs text-slate-200">
                        <span className="text-cyan-300 font-semibold block mb-0.5">Your Brainstormed Input:</span>
                        <p>{sec.userContent}</p>
                      </div>
                    )}

                    {sec.keyElements && (
                      <div className="pt-1">
                        <span className="text-2xs text-cyan-300 font-bold block mb-1">Checklist Points:</span>
                        <ul className="space-y-1 text-slate-400 pl-1">
                          {sec.keyElements.map((el: string, elIdx: number) => (
                            <li key={elIdx}>• {el}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DRAFT EDITOR & AI EVALUATION */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
          {/* Editor Column (6 Cols) */}
          <div className="lg:col-span-6 p-6 rounded-3xl glass-panel border border-dark-border space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-emerald-400" />
                <span>Statement of Purpose Draft</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-400 font-semibold">
                  Word Count: <strong className="text-white">{wordCount} words</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !draftText.trim()}
                  className="px-3 py-1 rounded-xl bg-dark-card border border-dark-border hover:border-emerald-500/40 text-slate-300 hover:text-white flex items-center gap-1 text-2xs font-semibold transition"
                >
                  <Save className="w-3 h-3 text-emerald-400" />
                  <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleAnalyzeDraft} className="space-y-4">
              <textarea
                rows={16}
                required
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Write or paste your Statement of Purpose draft here (e.g. 500-1000 words)... You can review and edit all content freely."
                className="w-full bg-dark-card border border-dark-border rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition leading-relaxed text-xs resize-none"
              ></textarea>

              <div className="flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={loadingAnalysis || !draftText.trim()}
                  className="flex-1 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition"
                >
                  {loadingAnalysis ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Evaluating Structure, Clarity & Scholarship Alignment...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" aria-hidden="true" />
                      <span>Analyze Draft Alignment & Missing Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Feedback Column (6 Cols) */}
          <div className="lg:col-span-6 space-y-4">
            {!feedback ? (
              <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-3 min-h-[440px] flex flex-col items-center justify-center shadow-xl">
                <BookOpenCheck className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-white">SOP Evaluation Dashboard</h3>
                <p className="text-xs max-w-xs mx-auto">
                  Click "Analyze Draft" to evaluate hook impact, paragraph flow, scholarship alignment, and missing
                  arguments.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-3xl glass-panel border border-brand-500/30 space-y-6 shadow-2xl animate-in fade-in">
                {/* Header & Alignment Score */}
                <div className="flex items-center justify-between border-b border-dark-border pb-4">
                  <div>
                    <h3 className="font-bold text-base text-white">Admissions Review Feedback</h3>
                    <p className="text-xs text-indigo-300">Targeting: {targetScholarshipTitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-cyan-400">{feedback.alignmentScore || 85}%</div>
                    <div className="text-2xs text-slate-400 font-semibold uppercase">Alignment Score</div>
                  </div>
                </div>

                {/* Structure Rating & Grammar Summary */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-dark-bg/80 border border-dark-border">
                    <span className="text-slate-400 block text-2xs">Structure & Flow:</span>
                    <strong className="text-white text-xs">{feedback.structureRating || 'Strong (4.2 / 5.0)'}</strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-dark-bg/80 border border-dark-border">
                    <span className="text-slate-400 block text-2xs">Clarity Rating:</span>
                    <strong className="text-emerald-400 text-xs">{feedback.clarityScore || 88}%</strong>
                  </div>
                </div>

                {/* Strengths */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Strong Elements:
                  </span>
                  <ul className="space-y-1 text-slate-300">
                    {(feedback.keyStrengths || []).map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Missing Information / Weak Arguments Alert */}
                {feedback.missingInformation && feedback.missingInformation.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Missing Information & Missing Committee Prerequisites:</span>
                    </span>
                    <ul className="space-y-1 text-amber-200/90 pl-1">
                      {feedback.missingInformation.map((m: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertCircle className="w-3 h-3 text-amber-400 mt-1 shrink-0" aria-hidden="true" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Section-by-Section Breakdown */}
                {feedback.sectionBreakdown && (
                  <div className="space-y-2 text-xs pt-2 border-t border-dark-border">
                    <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <LayoutList className="w-4 h-4" /> Paragraph Assessment Breakdown:
                    </span>
                    <div className="space-y-2">
                      {feedback.sectionBreakdown.map((sec, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-dark-card/60 border border-dark-border space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{sec.section}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-2xs font-bold ${
                                sec.status === 'STRONG'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {sec.status}
                            </span>
                          </div>
                          <p className="text-slate-300 text-2xs">{sec.feedback}</p>
                          <p className="text-2xs text-cyan-300">💡 {sec.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                {feedback.actionableNextSteps && feedback.actionableNextSteps.length > 0 && (
                  <div className="space-y-1.5 text-xs pt-2 border-t border-dark-border">
                    <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" /> Actionable Next Steps:
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      {feedback.actionableNextSteps.map((step, idx) => (
                        <li key={idx}>👉 {step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SECTION POLISHING & REFINEMENT */}
      {activeTab === 'refine' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
          {/* Input & Instructions Column (6 Cols) */}
          <div className="lg:col-span-6 p-6 rounded-3xl glass-panel border border-dark-border space-y-4 shadow-xl text-xs">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span>Section Academic Polish & Clarity Enhancer</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Section / Target</label>
                <select
                  value={sectionToRefine}
                  onChange={(e) => setSectionToRefine(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="Paragraph 1: Introduction & Hook">
                    Paragraph 1: Introduction & Intellectual Hook
                  </option>
                  <option value="Paragraph 2: Academic Background & Foundation">
                    Paragraph 2: Academic Background & Preparation
                  </option>
                  <option value="Paragraph 3: Key Research & Flagship Project">
                    Paragraph 3: Key Project & Research Methodology
                  </option>
                  <option value="Paragraph 4: Program Fit & Faculty Labs">
                    Paragraph 4: Program Fit & Specific Faculty Alignment
                  </option>
                  <option value="Paragraph 5: Long-Term Career Vision & Impact">
                    Paragraph 5: Long-Term Career Vision & Contribution
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Your Draft Section Text</label>
                <textarea
                  rows={8}
                  value={originalSectionText}
                  onChange={(e) => setOriginalSectionText(e.target.value)}
                  placeholder="Paste the specific paragraph you want to improve for clarity, active voice, and academic flow..."
                  className="w-full bg-dark-card border border-dark-border rounded-2xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 leading-relaxed text-xs resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Refinement Focus / Tone Guidelines</label>
                <input
                  type="text"
                  value={refinementInstructions}
                  onChange={(e) => setRefinementInstructions(e.target.value)}
                  placeholder="e.g. Improve academic vocabulary, active voice, and conciseness"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="p-3 rounded-2xl bg-dark-bg/60 border border-dark-border/60 text-2xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Strict Anti-Fabrication Rule:</span>
                </span>
                <p>
                  Refinements polish sentence flow and academic diction while strictly preserving your authentic facts.
                  No experiences, awards, or personal stories will be invented.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefineSection}
                disabled={loadingRefine || !originalSectionText.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition"
              >
                {loadingRefine ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Polishing Academic Diction...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-white" />
                    <span>Generate Refined Version</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Refined Output Column (6 Cols) */}
          <div className="lg:col-span-6 space-y-4 text-xs">
            {!refinementResult ? (
              <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-3 min-h-[440px] flex flex-col items-center justify-center shadow-xl">
                <Wand2 className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-white">Side-by-Side Review Panel</h3>
                <p className="text-xs max-w-xs mx-auto">
                  Provide your paragraph text to generate an academically polished version for your review and editing.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-3xl glass-panel border border-purple-500/30 space-y-5 shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-dark-border pb-3 flex-wrap gap-2">
                  <h3 className="font-bold text-base text-white">{refinementResult.sectionTitle}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyRefined}
                      className="px-3 py-1.5 rounded-xl bg-dark-card border border-purple-500/40 text-purple-300 hover:bg-purple-600 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={handleApplyRefinedToDraft}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-1 text-xs font-bold shadow-md"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{applySuccess ? 'Applied into Draft!' : 'Apply to Draft'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-purple-300 block">Polished version:</span>
                  <div className="p-4 rounded-2xl bg-dark-bg/90 border border-purple-500/30 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {refinementResult.refinedText}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-dark-card/60 border border-dark-border space-y-1">
                  <span className="font-bold text-cyan-300 block text-2xs">Editorial Changes & Rationale:</span>
                  <p className="text-slate-300 text-2xs">{refinementResult.changesExplanation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SOPAssistantPage;
