import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'agent'
  text: string
}

const AGENT_BASE = import.meta.env.VITE_AGENT_BASE ?? 'http://localhost:8001'

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
      <div className="w-full max-w-lg mt-2">
        <button
          onClick={() => navigate('/login')}
          className="mt-2 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/15 text-white/50 font-semibold rounded-xl transition-colors backdrop-blur-sm"
        >
          🔒 Log in to use the AI assistant
        </button>
      </div>
    )
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
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
    <div className="w-full max-w-lg mt-2">

      <button
        onClick={() => setOpen(o => !o)}
        className="mt-2 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 font-semibold rounded-xl transition-colors backdrop-blur-sm"
      >
        {open ? 'Hide AI Assistant' : 'Ask AI about a suburb'}
      </button>

      {open && (
        <div className="mt-1 bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl overflow-hidden">

          <div className="h-64 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-white/30 text-sm text-center mt-10">
                e.g. "What is the education level in Glebe?"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <span className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-white/15 border border-white/20 text-white'
                    : 'bg-white/5 border border-white/10 text-white/90'
                }`}>
                  {m.text || <span className="text-white/30 animate-pulse">…</span>}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 pb-3 pt-2 border-t border-white/10 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
              placeholder="Ask about a suburb..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 backdrop-blur-sm text-base disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-5 py-3 bg-white/20 hover:bg-white/30 border border-white/20 text-white font-semibold rounded-xl transition-colors backdrop-blur-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
