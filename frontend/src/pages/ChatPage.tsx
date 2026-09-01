import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Plus, Trash2, Database, RefreshCw, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatApi, datasetsApi, type ChatSession, type Message, type Dataset } from '../services/api';
import { Card } from '../components/ui';
import { useStore } from '../store';

export const ChatPage: React.FC = () => {
  const { selectedDataset } = useStore();
  const [sessions, setSessions]       = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [datasets, setDatasets]       = useState<Dataset[]>([]);
  const [selectedDs, setSelectedDs]   = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
    datasetsApi.list().then(r => {
      const own    = r.datasets.filter(d => d.status === 'ready');
      const shared = ((r as unknown as { sharedDatasets: Dataset[] }).sharedDatasets || []).filter(d => d.status === 'ready');
      const ready  = [...own, ...shared];
      setDatasets(ready);
      if (selectedDataset?.status === 'ready') setSelectedDs(selectedDataset.id);
      else if (ready.length > 0) setSelectedDs(ready[0].id);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSessions() {
    setLoading(true);
    try { const res = await chatApi.getSessions(); setSessions(res.sessions); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function newSession() {
    try {
      const res = await chatApi.createSession(selectedDs || undefined);
      setSessions(prev => [res.session, ...prev]);
      setActiveSession(res.session);
      setMessages([]);
    } catch (err) { console.error(err); }
  }

  async function openSession(s: ChatSession) {
    try {
      const res = await chatApi.getSession(s.id);
      setActiveSession(res.session);
      setMessages(res.session.messages || []);
    } catch (err) { console.error(err); }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) { setActiveSession(null); setMessages([]); }
    } catch (err) { console.error(err); }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !activeSession) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await chatApi.sendMessage(activeSession.id, userMsg.content);
      setMessages(prev => [...prev, res.message]);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: userMsg.content.slice(0, 40) } : s));
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally { setSending(false); }
  }

  const suggestions = [
    'What are the main columns in this dataset?',
    'How many missing values are there?',
    'What are the key statistics?',
    'Are there any outliers?',
  ];

  const selectedDsName = datasets.find(d => d.id === selectedDs)?.name;

  return (
    <div className="flex h-[calc(100vh-112px)] gap-5">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">

        {/* Dataset selector */}
        <Card className="p-4">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Dataset</p>
          <select
            value={selectedDs}
            onChange={e => setSelectedDs(e.target.value)}
            className="input w-full text-sm py-2"
          >
            <option value="">Select a dataset…</option>
            {datasets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.source === 'shared' ? `📤 ${d.name} (${d.sharedByName})` : d.name}
                  </option>
                ))}
          </select>
        </Card>

        {/* New chat button */}
        <button
          onClick={newSession}
          disabled={!selectedDs}
          className="btn-primary flex items-center gap-2 text-sm justify-center py-2.5 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>

        {/* Sessions list */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-surface-400">
                <MessageSquare className="w-7 h-7 mx-auto mb-2 text-surface-300" />
                No conversations yet
              </div>
            ) : sessions.map(s => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-left group transition-colors mb-1 ${
                  activeSession?.id === s.id
                    ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400'
                    : 'hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.title || 'New Conversation'}</p>
                  {s.datasetName && (
                    <p className="text-[10px] text-surface-400 truncate mt-0.5">{s.datasetName}</p>
                  )}
                </div>
                <Trash2
                  onClick={e => deleteSession(s.id, e)}
                  className="w-3.5 h-3.5 text-surface-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0"
                />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Chat Area ─────────────────────────────────────────────────────── */}
      <Card className="flex-1 flex flex-col overflow-hidden">

        {!activeSession ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Chat with your Data</h2>
            <p className="text-surface-500 text-sm mb-6 max-w-sm leading-relaxed">
              Ask questions about your dataset in plain English and get instant AI-powered answers.
            </p>
            {selectedDs ? (
              <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 rounded-xl px-4 py-2 text-sm mb-5">
                <Database className="w-4 h-4" />
                <span className="font-medium">{selectedDsName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-surface-400 mb-5">
                <Database className="w-3.5 h-3.5" />
                <span>Select a dataset from the left panel first</span>
              </div>
            )}
            <button
              onClick={newSession}
              disabled={!selectedDs}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Start Conversation
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-100 dark:border-surface-800">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">{activeSession.title || 'New Conversation'}</p>
                {activeSession.datasetName && (
                  <p className="text-xs text-surface-400">{activeSession.datasetName}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-surface-500 mb-4">Ask anything about your dataset</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); inputRef.current?.focus(); }}
                        className="text-xs px-3 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:text-brand-600 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mr-2.5 mt-0.5 flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-500 text-white rounded-tr-sm'
                        : 'bg-surface-100 dark:bg-surface-800 rounded-tl-sm text-surface-800 dark:text-surface-200'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </motion.div>
                ))}

                {sending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mr-2.5 flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1.5">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-surface-100 dark:border-surface-800">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask about your data… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{ resize: 'none' }}
                  className="input flex-1 text-sm py-2.5 min-h-[44px] max-h-32"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="btn-primary p-2.5 disabled:opacity-50 flex-shrink-0"
                >
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};