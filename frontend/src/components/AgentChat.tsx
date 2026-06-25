import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'agent'
  text: string
}

const AGENT_BASE = import.meta.env.VITE_AGENT_BASE ?? 'http://localhost:8001'

// Suburb-specific examples — clicking sends them to the agent (LLM + tools).
const SUGGESTIONS = [
  'What is the tenure trend in Glebe?',
  'What is the education level in Carlton?',
  'Top languages spoken at home in Box Hill?',
  'Which suburbs are near Newtown?',
]

// Generic FAQs — answered instantly, client-side. No LLM call, no network,
// and they don't count against the daily question limit.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What data can you look up?',
    a: 'I can pull ABS Census data for a suburb across 2011, 2016 and 2021:\n• Tenure trends (owned / mortgage / rented) + the SuburbLens Residency Shift Index\n• Education qualification levels\n• Languages spoken at home\n• Country of birth\n• Nearby suburbs (within ~20km)\n\nJust name a Sydney or Melbourne suburb.',
  },
  {
    q: 'Where does the data come from?',
    a: 'All figures come from the Australian Bureau of Statistics (ABS) Census — the 2011, 2016 and 2021 releases. Nothing is estimated or scraped.',
  },
  {
    q: 'Which cities are covered?',
    a: 'Currently Greater Sydney and Greater Melbourne only. Other regions are out of scope for now.',
  },
]

// Loose match so a typed FAQ (not just a clicked chip) still short-circuits.
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').trim()
function lookupFaq(text: string): string | null {
  const n = normalize(text)
  return FAQ.find(f => normalize(f.q) === n)?.a ?? null
}

export default function AgentChat() {
  const { isGuest, user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Guests can't use the AI assistant — the agent rejects anonymous users
  // server-side, so here we just hide the chat and invite them to log in.
  if (isGuest) {
    return (
      <div className="w-full">
        <button
          onClick={() => navigate('/login')}
          className="w-full py-3.5 border border-white/15 hover:border-white/30 text-faint hover:text-fg font-display font-medium rounded-xl transition-colors"
        >
          🔒 Log in to use the AI assistant
        </button>
      </div>
    )
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || loading) return

    setInput('')

    // B — generic FAQ: answer instantly client-side, skip the LLM entirely.
    const canned = lookupFaq(text)
    if (canned) {
      setMessages(prev => [...prev, { role: 'user', text }, { role: 'agent', text: canned }])
      return
    }

    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text }])
    setMessages(prev => [...prev, { role: 'agent', text: '' }])

    function setLastAgent(textValue: string) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'agent', text: textValue }
        return next
      })
    }

    try {
      // Always read the current (possibly just-refreshed) access token.
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      const res = await fetch(`${AGENT_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // thread_id = user id so the agent's persisted history follows the
        // account across devices/reloads.
        body: JSON.stringify({ message: text, thread_id: user?.id ?? 'default' }),
      })

      if (!res.ok || !res.body) {
        setLastAgent(
          res.status === 401 || res.status === 403
            ? 'Please log in with an account to use the AI assistant.'
            : res.status === 429
            ? "You've reached today's limit of 50 questions. Please come back tomorrow."
            : `Error: agent returned ${res.status}.`
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'agent', text: next[next.length - 1].text + chunk }
          return next
        })
      }
    } catch {
      setLastAgent('Error: could not reach agent service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">

      <button
        onClick={() => setOpen(o => !o)}
        className="w-full py-3.5 bg-surface-2 hover:bg-surface-3 border border-white/10 text-fg font-display font-medium rounded-xl transition-colors"
      >
        {open ? 'Hide AI Assistant' : 'Ask AI about a suburb ✦'}
      </button>

      {open && (
        <div className="mt-2 bg-surface border border-white/[0.07] rounded-xl shadow-2xl shadow-black/40 overflow-hidden">

          <div className="h-64 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="pt-3 space-y-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-dim mb-2">
                    Quick answers
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FAQ.map(f => (
                      <button
                        key={f.q}
                        onClick={() => send(f.q)}
                        className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 border border-white/10 text-faint hover:text-fg text-xs transition-colors"
                      >
                        {f.q}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-dim mb-2">
                    Try asking
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 border border-white/10 text-faint hover:text-fg text-xs transition-colors text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <span className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-lemon/15 border border-lemon/25 text-fg'
                    : 'bg-surface-2 border border-white/10 text-fg/90'
                }`}>
                  {m.text || <span className="text-faint animate-pulse">…</span>}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {messages.length > 0 && (
            <div className="px-3 pt-2 pb-1.5 flex gap-2 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
              {[...FAQ.map(f => f.q), ...SUGGESTIONS].map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 border border-white/10 text-faint hover:text-fg text-xs whitespace-nowrap transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 pb-3 pt-2 border-t border-white/[0.07] flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
              placeholder="Ask about a suburb…"
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/10 text-fg placeholder:text-dim focus:outline-none focus:border-lemon/60 text-base disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="px-5 py-3 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
