import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { Markdown } from '../components/common/Markdown';
import { ChatMessage } from '../types';
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  FileText,
  Layers,
  Loader2,
  Plus,
  RotateCw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';

interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  messages?: ChatMessage[];
}

export const AIAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolExecutingStatus, setToolExecutingStatus] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedToolMap, setExpandedToolMap] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestedPrompts = [
    { label: 'Find fully funded scholarships for me', icon: Search },
    { label: 'Review my CV for scholarship readiness', icon: FileText },
    { label: 'Help me structure my Statement of Purpose', icon: BookOpenCheck },
    { label: 'Check my eligibility', icon: ShieldCheck },
    { label: 'Show my upcoming deadlines', icon: Clock },
    { label: 'Compare my saved scholarships', icon: Scale },
    { label: 'Show my tracked applications', icon: Layers },
  ];

  // Load conversations and student profile
  useEffect(() => {
    loadProfile();
    loadConversations();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, toolExecutingStatus]);

  const loadProfile = async () => {
    try {
      const p = await api.getProfile();
      setUserProfile(p);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
      if (convs.length > 0) {
        selectConversation(convs[0].id);
      } else {
        createNewSession();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      createNewSession();
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveSessionId(convId);
    setErrorMessage(null);
    try {
      const conv = await api.getMessages(convId);
      if (conv && conv.messages) {
        setMessages(conv.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load messages for conversation:', convId, err);
      setMessages([]);
    }
  };

  const createNewSession = async () => {
    try {
      const newConv = await api.createConversation('New Scholarship Strategy');
      setConversations((prev) => [newConv, ...prev]);
      setActiveSessionId(newConv.id);
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          sender: 'ASSISTANT',
          content: `Hello! I am your **ScholarAI assistant** — connected directly to your academic profile and our verified scholarship database.\n\nAsk me to discover matching funding opportunities, evaluate your prerequisites, manage application deadlines, or compare financial packages.`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Failed to create session:', err);
      setActiveSessionId('new');
    }
  };

  const handleDeleteSession = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation session?')) return;

    try {
      await api.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeSessionId === convId) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          createNewSession();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleRenameSession = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      const updated = await api.renameConversation(convId, editTitle.trim());
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c)));
      setEditingSessionId(null);
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const query = textOverride || input;
    if (!query.trim() || loading) return;

    setErrorMessage(null);
    const tempUserMsg: ChatMessage = {
      id: 'temp-user-' + Date.now(),
      sender: 'USER',
      content: query.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    if (!textOverride) setInput('');
    setLoading(true);

    // Contextual status message for tool execution
    if (query.toLowerCase().includes('eligib')) {
      setToolExecutingStatus('Checking academic requirements & evaluating match score...');
    } else if (query.toLowerCase().includes('compar')) {
      setToolExecutingStatus('Fetching saved scholarships & generating side-by-side matrix...');
    } else if (query.toLowerCase().includes('deadline')) {
      setToolExecutingStatus('Calculating upcoming deadlines & urgency milestones...');
    } else if (query.toLowerCase().includes('save') || query.toLowerCase().includes('bookmark')) {
      setToolExecutingStatus('Updating your saved scholarships database...');
    } else {
      setToolExecutingStatus('Querying verified scholarships & analyzing profile compatibility...');
    }

    try {
      const res = await api.sendMessage(activeSessionId || 'new', query.trim());
      if (res.conversationId && res.conversationId !== activeSessionId) {
        setActiveSessionId(res.conversationId);
        // Refresh conversation list title if new
        loadConversations();
      }

      const assistantReply = res.message || res;
      setMessages((prev) => [...prev, assistantReply]);
    } catch (err: any) {
      console.error('Failed to process message:', err);
      const isRateLimit = err instanceof ApiError && err.status === 429;
      setErrorMessage(
        isRateLimit
          ? 'Rate limit reached. Please wait a few seconds before sending another message.'
          : err.message || 'Error communicating with AI Copilot agent. Please try again.'
      );
    } finally {
      setLoading(false);
      setToolExecutingStatus('');
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleToolExpand = (id: string) => {
    setExpandedToolMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to parse toolCalls if JSON string or object
  const parseToolCalls = (toolCalls: any) => {
    if (!toolCalls) return [];
    if (Array.isArray(toolCalls)) return toolCalls;
    try {
      const parsed = JSON.parse(toolCalls);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 max-w-7xl mx-auto">
      {/* LEFT DRAWER: Sessions List */}
      <div className="w-80 glass-panel border border-dark-border rounded-3xl p-4 flex flex-col justify-between hidden lg:flex">
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 border-b border-dark-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Chat Sessions</h3>
                <p className="text-2xs text-slate-400">Authenticated Context</p>
              </div>
            </div>
            <button
              onClick={createNewSession}
              className="p-1.5 rounded-xl bg-brand-600/30 text-brand-300 hover:bg-brand-600 hover:text-white border border-brand-500/40 transition flex items-center gap-1 text-xs font-semibold"
              title="Start New Session"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Session List Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs scrollbar-thin">
            {conversations.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No saved sessions yet.</div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeSessionId;
                const isEditing = editingSessionId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition border ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-900/60 to-dark-card border-brand-500/50 text-white shadow-md'
                        : 'border-transparent text-slate-400 hover:bg-dark-hover hover:text-slate-200'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 bg-dark-bg px-2 py-1 rounded text-xs text-white border border-brand-500 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleRenameSession(conv.id, e)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingSessionId(null)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold truncate">{conv.title}</p>
                          <p className="text-2xs text-slate-500">
                            {new Date(conv.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(conv.id);
                              setEditTitle(conv.title);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-dark-bg"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(conv.id, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-dark-bg"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Status Card */}
        {userProfile && (
          <div className="p-3 rounded-2xl bg-dark-card/90 border border-dark-border mt-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-2xs font-semibold text-slate-300">
              <span className="truncate">{userProfile.fullName}</span>
              <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 text-2xs">
                GPA {userProfile.gpa}/{userProfile.maxGpa}
              </span>
            </div>
            <p className="text-2xs text-slate-400 truncate">
              {userProfile.targetDegreeLevel} • {userProfile.fieldOfStudy}
            </p>
          </div>
        )}
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 glass-panel border border-dark-border rounded-3xl flex flex-col min-w-0 overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="p-4 bg-dark-card border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">ScholarAI assistant</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  15 Tools Orchestrator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connected to Postgres • Scoped strictly to authenticated student records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={createNewSession}
              className="px-3 py-1.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-xs text-slate-300 font-medium transition flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Session</span>
            </button>
          </div>
        </div>

        {/* Suggested Prompts Carousel */}
        <div className="p-3 bg-dark-bg/60 border-b border-dark-border/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-2xs font-semibold text-slate-500 shrink-0 ml-1">Suggested:</span>
          {suggestedPrompts.map((sp, idx) => {
            const Icon = sp.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(sp.label)}
                disabled={loading}
                className="px-3 py-1 rounded-full bg-brand-950/70 border border-brand-500/30 text-indigo-200 hover:bg-brand-600 hover:text-white text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Icon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{sp.label}</span>
              </button>
            );
          })}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-5 text-sm scrollbar-thin">
          {messages.map((m, idx) => {
            const isUser = m.sender === 'USER';
            const toolCalls = parseToolCalls(m.toolCalls);

            return (
              <div key={m.id || idx} className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-tr from-brand-600 to-indigo-600 text-white'
                      : 'bg-dark-card border border-brand-500/40 text-cyan-400'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Message Bubble + Tool Executions */}
                <div className={`max-w-[85%] md:max-w-[78%] space-y-2.5`}>
                  {/* Tool Executions Badges & Results */}
                  {!isUser && toolCalls.length > 0 && (
                    <div className="space-y-2">
                      {toolCalls.map((tc: any, tIdx: number) => {
                        const toolId = `${m.id}-tool-${tIdx}`;
                        const isExpanded = expandedToolMap[toolId];
                        const isSuccess = !tc.result?.error;

                        return (
                          <div
                            key={tIdx}
                            className="rounded-2xl bg-dark-bg/80 border border-brand-500/30 p-2.5 text-xs text-slate-300 font-mono shadow-sm"
                          >
                            <div
                              onClick={() => toggleToolExpand(toolId)}
                              className="flex items-center justify-between cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2">
                                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="font-bold text-white">{tc.toolName}</span>
                                <span className="text-2xs text-slate-400 font-normal">
                                  {tc.args ? JSON.stringify(tc.args).slice(0, 45) : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isSuccess ? (
                                  <span className="inline-flex items-center gap-1 text-2xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" /> Done
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-2xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                    <AlertCircle className="w-3 h-3" /> Error
                                  </span>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* Expanded JSON details */}
                            {isExpanded && (
                              <div className="mt-2.5 pt-2.5 border-t border-dark-border/60 text-2xs space-y-1.5">
                                <div>
                                  <span className="text-slate-400 font-semibold">Arguments:</span>
                                  <pre className="mt-1 p-2 rounded-lg bg-dark-card text-indigo-300 overflow-x-auto">
                                    {JSON.stringify(tc.args, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold">Result:</span>
                                  <pre className="mt-1 p-2 rounded-lg bg-dark-card text-emerald-300 overflow-x-auto">
                                    {JSON.stringify(tc.result, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Structured Interactive Renderers based on Tool Result */}
                            {/* 1. Search Scholarships / Recommendations Result Cards */}
                            {(tc.toolName === 'searchScholarships' || tc.toolName === 'getRecommendations') &&
                              tc.result?.items?.length > 0 && (
                                <div className="mt-2.5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans not-italic">
                                  {tc.result.items.slice(0, 4).map((item: any, iIdx: number) => (
                                    <div
                                      key={iIdx}
                                      className="p-2.5 rounded-xl bg-dark-card/90 border border-brand-500/20 hover:border-brand-500/50 transition flex flex-col justify-between"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <span className="text-2xs font-bold text-cyan-400 uppercase">
                                            {item.hostCountry}
                                          </span>
                                          {item.matchScore && (
                                            <span className="text-2xs font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                              {item.matchScore}% Match
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="font-bold text-xs text-white line-clamp-1">{item.title}</h4>
                                        <p className="text-2xs text-slate-400 mt-0.5">{item.fundingType}</p>
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-dark-border/40 flex items-center justify-between text-2xs">
                                        <span className="text-slate-400">
                                          {item.deadline
                                            ? new Date(item.deadline).toLocaleDateString([], {
                                                month: 'short',
                                                day: 'numeric',
                                              })
                                            : 'Rolling'}
                                        </span>
                                        <button
                                          onClick={() => handleSend(`Am I eligible for ${item.title}?`)}
                                          className="text-brand-300 hover:text-white flex items-center gap-0.5 font-semibold"
                                        >
                                          Check <ArrowRight className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                            {/* 2. Check Eligibility Structured Card */}
                            {tc.toolName === 'checkEligibility' && tc.result?.matchScore !== undefined && (
                              <div className="mt-2.5 pt-2 p-3 rounded-xl bg-dark-card/90 border border-emerald-500/30 font-sans not-italic space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    <span className="font-bold text-xs text-white">Eligibility Score</span>
                                  </div>
                                  <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                                    {tc.result.matchScore}% • {tc.result.eligibilityStatus}
                                  </span>
                                </div>
                                {tc.result.matchingCriteria?.length > 0 && (
                                  <div className="text-2xs text-emerald-300/90 space-y-0.5">
                                    {tc.result.matchingCriteria.slice(0, 2).map((crit: string, cIdx: number) => (
                                      <p key={cIdx} className="flex items-start gap-1.5">
                                        <Check className="w-3 h-3 text-emerald-400 mt-1 shrink-0" aria-hidden="true" />
                                        <span>{crit}</span>
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 3. Deadlines List Cards */}
                            {tc.toolName === 'getUpcomingDeadlines' &&
                              Array.isArray(tc.result) &&
                              tc.result.length > 0 && (
                                <div className="mt-2.5 pt-2 space-y-1.5 font-sans not-italic">
                                  {tc.result.slice(0, 3).map((d: any, dIdx: number) => (
                                    <div
                                      key={dIdx}
                                      className="p-2 rounded-xl bg-dark-card border border-amber-500/30 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <p className="font-bold text-white text-2xs truncate max-w-[200px]">
                                          {d.title}
                                        </p>
                                        <p className="text-2xs text-slate-400">
                                          Due {d.deadlineFormatted} ({d.daysRemaining} days left)
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleSend(`Set a reminder for ${d.title} deadline`)}
                                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white text-2xs font-semibold transition"
                                      >
                                        Set Reminder
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                            {/* 4. CV Analysis Structured Card */}
                            {(tc.toolName === 'getCVAnalysis' || tc.toolName === 'analyzeCV') &&
                              tc.result?.score !== undefined && (
                                <div className="mt-2.5 pt-2 p-3.5 rounded-2xl bg-dark-card/90 border border-emerald-500/30 font-sans not-italic space-y-2.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-emerald-400" />
                                      <span className="font-bold text-white">CV Review Score</span>
                                    </div>
                                    <span className="font-extrabold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                                      {tc.result.score} / 100
                                    </span>
                                  </div>

                                  {tc.result.skillsFound?.length > 0 && (
                                    <div>
                                      <span className="text-2xs text-slate-400 block mb-1">Extracted Skills:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {tc.result.skillsFound.slice(0, 6).map((s: string, sIdx: number) => (
                                          <span
                                            key={sIdx}
                                            className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-2xs"
                                          >
                                            {s}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {tc.result.missingInformation?.length > 0 && (
                                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-2xs text-rose-300">
                                      <span className="font-bold block mb-0.5">Missing information:</span>
                                      <p className="line-clamp-2">{tc.result.missingInformation[0]}</p>
                                    </div>
                                  )}

                                  <div className="pt-1 flex items-center justify-between border-t border-dark-border/40">
                                    <span className="text-2xs text-slate-400">Deep credential breakdown available</span>
                                    <button
                                      onClick={() => navigate('/cv-assistant')}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xs flex items-center gap-1 transition"
                                    >
                                      <span>Open CV Assistant</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                            {/* 5. SOP Review Structured Card */}
                            {tc.toolName === 'reviewSOPDraft' && tc.result?.alignmentScore !== undefined && (
                              <div className="mt-2.5 pt-2 p-3.5 rounded-2xl bg-dark-card/90 border border-indigo-500/30 font-sans not-italic space-y-2.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <BookOpenCheck className="w-4 h-4 text-indigo-400" />
                                    <span className="font-bold text-white">SOP Alignment</span>
                                  </div>
                                  <span className="font-extrabold text-cyan-400 bg-cyan-500/20 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                                    {tc.result.alignmentScore}% • {tc.result.structureRating || 'Reviewed'}
                                  </span>
                                </div>

                                {tc.result.keyStrengths?.length > 0 && (
                                  <div className="text-2xs text-emerald-300/90 space-y-0.5">
                                    <span className="font-semibold block text-emerald-400">Key strength:</span>
                                    <p className="line-clamp-1">{tc.result.keyStrengths[0]}</p>
                                  </div>
                                )}

                                {tc.result.missingInformation?.length > 0 && (
                                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-2xs text-amber-300">
                                    <span className="font-bold block mb-0.5">Missing points:</span>
                                    <p className="line-clamp-2">{tc.result.missingInformation[0]}</p>
                                  </div>
                                )}

                                <div className="pt-1 flex items-center justify-between border-t border-dark-border/40">
                                  <span className="text-2xs text-slate-400">Interactive drafting & polish</span>
                                  <button
                                    onClick={() => navigate('/sop-assistant')}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-2xs flex items-center gap-1 transition"
                                  >
                                    <span>Open SOP Assistant</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 6. SOP Outline Structured Card */}
                            {tc.toolName === 'getSOPOutline' && Array.isArray(tc.result?.outline) && (
                              <div className="mt-2.5 pt-2 p-3.5 rounded-2xl bg-dark-card/90 border border-indigo-500/30 font-sans not-italic space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white flex items-center gap-1.5">
                                    <BookOpenCheck className="w-4 h-4 text-indigo-400" />
                                    <span>5-Paragraph Blueprint</span>
                                  </span>
                                  <button
                                    onClick={() => navigate('/sop-assistant')}
                                    className="text-cyan-300 hover:text-white font-semibold text-2xs flex items-center gap-0.5"
                                  >
                                    Open Editor <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <div className="space-y-1 text-2xs text-slate-300">
                                  {tc.result.outline.slice(0, 3).map((sec: any, sIdx: number) => (
                                    <div key={sIdx} className="truncate">
                                      <span className="text-indigo-400 font-bold">P{sec.paragraphNumber}:</span>{' '}
                                      {sec.sectionTitle}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 7. SOP Refinement Structured Card */}
                            {tc.toolName === 'refineSOPSection' && tc.result?.refinedText && (
                              <div className="mt-2.5 pt-2 p-3.5 rounded-2xl bg-dark-card/90 border border-purple-500/30 font-sans not-italic space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                                    <Wand2 className="w-4 h-4 text-purple-400" />
                                    <span>Polished Academic Section</span>
                                  </span>
                                  <span className="text-2xs text-emerald-400 font-semibold">
                                    Strict Facts Preserved
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-dark-bg text-2xs text-slate-200 leading-relaxed max-h-28 overflow-y-auto">
                                  {tc.result.refinedText}
                                </div>
                                <p className="text-2xs text-slate-400">{tc.result.changesExplanation}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Main Assistant / User Content Card */}
                  <div
                    className={`p-4 rounded-3xl leading-relaxed break-words ${
                      isUser
                        ? 'bg-brand-600 text-white rounded-tr-none shadow-lg whitespace-pre-wrap'
                        : 'bg-dark-card border border-dark-border text-slate-100 rounded-tl-none shadow-md'
                    }`}
                  >
                    {/* The agent replies in Markdown; rendering it raw showed literal
                        "###" and "**" to the user. User text stays verbatim. */}
                    {isUser ? m.content : <Markdown content={m.content} />}
                  </div>

                  {/* Message Footnote / Copy Button */}
                  {!isUser && (
                    <div className="flex items-center gap-2 text-2xs text-slate-500 px-1">
                      <span>ScholarAI assistant</span>
                      <span>•</span>
                      <button
                        onClick={() => handleCopy(m.content, idx)}
                        className="hover:text-slate-300 flex items-center gap-1 transition"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedIndex === idx ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-2xl bg-dark-card border border-brand-500/40 text-cyan-400 flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 animate-pulse text-brand-400" />
              </div>
              <div className="p-4 rounded-3xl rounded-tl-none bg-dark-card border border-dark-border text-slate-300 text-xs flex items-center gap-3 shadow-md">
                <Loader2 className="w-4 h-4 text-brand-400 animate-spin" aria-hidden="true" />
                <span className="animate-pulse">
                  {toolExecutingStatus || 'Orchestrating AI tools & querying database...'}
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => handleSend()}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-200 text-2xs font-semibold transition"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 md:p-4 border-t border-dark-border bg-dark-card/80 backdrop-blur-md flex items-end gap-2.5"
        >
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Ask about scholarships, eligibility, deadlines, saved items, or application tracking..."
              className="w-full bg-dark-bg border border-dark-border rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition resize-none max-h-32 shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 rounded-2xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 disabled:opacity-50 text-white transition shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistantPage;
