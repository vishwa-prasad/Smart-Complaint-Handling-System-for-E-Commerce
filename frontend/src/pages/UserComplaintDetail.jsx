import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const PRIORITY_COLORS = {
  High:   'bg-orange-100 text-orange-700 border-orange-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30',
  Low:    'bg-green-100 text-green-700 border-green-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
}

/* ── Banner ─────────────────────────────────────────────────────── */
function ExpectedResolutionBanner({ complaint }) {
  if (['Resolved', 'Closed'].includes(complaint.status)) return null
  const msgs = {
    'Awaiting Response': { icon: '💬', text: "Our agent has a question for you — please reply below so we can continue resolving your complaint.", light: 'bg-amber-50 border-amber-200 text-amber-800', dark: 'dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300' },
    'Escalated':         { icon: '🚀', text: 'Your complaint has been escalated to our senior team and is being handled with high priority.',       light: 'bg-red-50 border-red-200 text-red-800',     dark: 'dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300' },
    'In Progress':       { icon: '🔍', text: "Our team is actively working on your complaint. We'll update you as soon as we have a resolution.",   light: 'bg-purple-50 border-purple-200 text-purple-800', dark: 'dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-300' },
    'Open':              { icon: '📬', text: 'Your complaint has been received and will be assigned to an agent shortly.',                           light: 'bg-blue-50 border-blue-200 text-blue-800',  dark: 'dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300' },
  }
  const meta = msgs[complaint.status] || msgs['Open']
  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${meta.light} ${meta.dark}`}>
      <span className="text-lg mt-0.5">{meta.icon}</span>
      <p className="text-sm leading-relaxed">{meta.text}</p>
    </div>
  )
}

/* ── Status Tracker ──────────────────────────────────────────────── */
function StatusTracker({ complaint, history }) {
  const statusTime = {}
  history.forEach((h) => { if (!statusTime[h.status]) statusTime[h.status] = h.created_at })
  const currentStatus = complaint.status
  const isEscalated   = history.some((h) => h.status === 'Escalated')
  const isAwaiting    = complaint.status === 'Awaiting Response'

  const BASE_STEPS = [
    { key: 'Open',              label: 'Submitted',      icon: '📝', desc: 'Your complaint has been received',      color: 'blue'   },
    { key: 'In Progress',       label: 'Under Review',   icon: '🔍', desc: 'Our team is investigating your issue',  color: 'purple' },
    { key: 'Awaiting Response', label: 'Info Requested', icon: '💬', desc: 'Agent needs more details from you',     color: 'amber'  },
    { key: 'Escalated',         label: 'Escalated',      icon: '🚨', desc: 'Escalated to senior team',              color: 'red'    },
    { key: 'Resolved',          label: 'Resolved',       icon: '✅', desc: 'Your complaint has been resolved',      color: 'green'  },
  ]

  const steps = BASE_STEPS.filter(s => {
    if (s.key === 'Escalated' && !isEscalated) return false
    if (s.key === 'Awaiting Response' && !isAwaiting && !statusTime['Awaiting Response']) return false
    return true
  })

  // Light mode classes / dark mode classes per colour
  const COLOR_MAP = {
    blue:   { ring: 'ring-blue-400 dark:ring-cyan-500/40',     bg: 'bg-blue-600 dark:bg-cyan-500',    text: 'text-blue-600 dark:text-cyan-400',    light: 'bg-blue-50 border-blue-200 dark:bg-cyan-500/10 dark:border-cyan-500/30'    },
    purple: { ring: 'ring-purple-400 dark:ring-violet-500/40', bg: 'bg-purple-600 dark:bg-violet-500',text: 'text-purple-600 dark:text-violet-400', light: 'bg-purple-50 border-purple-200 dark:bg-violet-500/10 dark:border-violet-500/30' },
    amber:  { ring: 'ring-amber-400 dark:ring-amber-500/40',   bg: 'bg-amber-500',                    text: 'text-amber-700 dark:text-amber-400',   light: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30'  },
    red:    { ring: 'ring-red-400 dark:ring-rose-500/40',      bg: 'bg-red-600 dark:bg-rose-500',     text: 'text-red-600 dark:text-rose-400',      light: 'bg-red-50 border-red-200 dark:bg-rose-500/10 dark:border-rose-500/30'       },
    green:  { ring: 'ring-green-400 dark:ring-emerald-500/40', bg: 'bg-green-600 dark:bg-emerald-500',text: 'text-green-600 dark:text-emerald-400', light: 'bg-green-50 border-green-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' },
  }

  const currentIdx = steps.findIndex(s => s.key === currentStatus)

  const formatTime = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return { date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
  }

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-6">📦 Complaint Status Tracker</h3>
      <div className="relative">
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-100 dark:bg-gray-700/60 z-0" />
        <div className="space-y-6 relative z-10">
          {steps.map((step, idx) => {
            const isDone    = idx <= currentIdx
            const isCurrent = idx === currentIdx
            const isPending = idx > currentIdx
            const c = COLOR_MAP[step.color]
            const ts = formatTime(statusTime[step.key])
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500 ${
                  isCurrent ? `${c.bg} border-transparent ring-4 ${c.ring} ring-opacity-30 shadow-lg`
                  : isDone  ? `${c.bg} border-transparent`
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <span className={`text-lg ${isPending ? 'opacity-30 grayscale' : ''}`}>
                    {isDone ? (isCurrent ? step.icon : '✓') : step.icon}
                  </span>
                </div>
                <div className={`flex-1 rounded-xl p-3 transition-all duration-300 ${isCurrent ? `${c.light} border` : 'bg-transparent'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isCurrent ? c.text : isDone ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                      {step.label}
                      {isCurrent && <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${c.bg} text-white dark:text-gray-900 font-bold`}>Now</span>}
                    </span>
                    {ts && isDone && <span className="text-xs text-gray-400 dark:text-gray-600 whitespace-nowrap">{ts.date} · {ts.time}</span>}
                  </div>
                  <p className={`text-xs mt-0.5 ${isCurrent ? c.text + ' opacity-80' : isDone ? 'text-gray-400 dark:text-gray-500' : 'text-gray-200 dark:text-gray-700'}`}>{step.desc}</p>
                  {step.key === 'Awaiting Response' && isCurrent && (
                    <p className="text-xs mt-1 text-amber-700 dark:text-amber-400 font-medium">👇 Please scroll down to respond</p>
                  )}
                  {step.key === 'Resolved' && isDone && complaint.resolution_note && (
                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-emerald-500/20">
                      <p className="text-xs text-green-700 dark:text-emerald-400 leading-relaxed">{complaint.resolution_note}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Satisfaction Rating ─────────────────────────────────────────── */
function SatisfactionRating({ complaint, onRated }) {
  const [rating, setRating] = useState(0)
  const [hover,  setHover]  = useState(0)
  const [comment,   setComment]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)

  if (!['Resolved', 'Closed'].includes(complaint.status)) return null
  if (complaint.satisfaction_rating || submitted) {
    const r = complaint.satisfaction_rating
    return (
      <div className="bg-green-50 dark:bg-emerald-500/5 border border-green-200 dark:border-emerald-500/30 rounded-2xl p-5">
        <p className="text-sm font-bold text-green-700 dark:text-emerald-400 mb-2">⭐ Your Rating</p>
        <div className="flex gap-1 text-2xl mb-1">
          {[1,2,3,4,5].map(s => <span key={s} className={s <= (r || rating) ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}>★</span>)}
        </div>
        <p className="text-xs text-green-600 dark:text-emerald-500">Thank you for your feedback!</p>
      </div>
    )
  }

  const submit = async () => {
    if (!rating) return
    setLoading(true)
    try {
      await api.post(`/api/complaints/${complaint.complaint_id}/rate`, { rating, comment })
      setSubmitted(true); onRated && onRated()
    } catch (e) { alert(e.response?.data?.detail || 'Failed to submit rating') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-gray-100 dark:border-gray-700/60 rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">⭐ How was your experience?</h3>
      <div className="flex gap-2 mb-3">
        {[1,2,3,4,5].map(s => (
          <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
            className="text-3xl transition-transform hover:scale-110">
            <span className={(hover || rating) >= s ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}>★</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {rating === 1 ? '😞 Very unhappy' : rating === 2 ? '😕 Unhappy' : rating === 3 ? '😐 Neutral' : rating === 4 ? '😊 Happy' : rating === 5 ? '😁 Very happy' : 'Select a rating'}
      </p>
      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
        placeholder="Optional — tell us more about your experience..."
        className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 mb-3 resize-none focus:outline-none focus:border-blue-400 dark:focus:border-cyan-500/50 bg-white dark:bg-[#0d1117] text-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600" />
      <button onClick={submit} disabled={!rating || loading}
        className="w-full py-2 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-gray-900 text-sm font-semibold dark:font-bold disabled:opacity-40 transition-colors">
        {loading ? 'Submitting…' : 'Submit Rating'}
      </button>
    </div>
  )
}

/* ── Resolution Notes ────────────────────────────────────────────── */
function ResolutionNotes({ complaint, onReply }) {
  const [notes,   setNotes]   = useState([])
  const [reply,   setReply]   = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const fetchNotes = async () => {
    try { const res = await api.get(`/api/complaints/${complaint.complaint_id}/notes`); setNotes(res.data || []) } catch (e) {}
  }

  useEffect(() => { fetchNotes() }, [complaint.complaint_id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [notes])

  const send = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await api.post(`/api/complaints/${complaint.complaint_id}/notes`, { note: reply.trim(), is_internal: false })
      setReply(''); await fetchNotes(); onReply && onReply()
    } catch (e) { alert(e.response?.data?.detail || 'Failed to send') }
    finally { setSending(false) }
  }

  const isAwaiting = complaint.status === 'Awaiting Response'
  const canReply   = !['Resolved', 'Closed'].includes(complaint.status)

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col" style={{ minHeight: 320 }}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">💬 Updates & Communication</h3>
        {isAwaiting && (
          <span className="text-xs bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border dark:border-amber-500/30 px-2 py-1 rounded-full font-semibold animate-pulse">
            ⚠️ Response needed
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-80">
        {notes.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">No updates yet. Your agent will post updates here.</p>
        )}
        {notes.map(n => {
          const isAgent = n.author_role !== 'user'
          return (
            <div key={n.id} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                isAgent
                  ? 'bg-gray-100 dark:bg-[#1a2535] text-gray-800 dark:text-gray-200 rounded-tl-sm dark:border dark:border-gray-700/60'
                  : 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-gray-900 rounded-tr-sm'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-xs font-semibold ${isAgent ? 'text-indigo-600 dark:text-violet-400' : 'text-blue-200 dark:text-gray-700'}`}>
                    {isAgent ? `${n.author_name} (Agent)` : 'You'}
                  </span>
                </div>
                <p className="leading-relaxed">{n.note}</p>
                <p className={`text-xs mt-1 ${isAgent ? 'text-gray-400 dark:text-gray-500' : 'text-blue-300 dark:text-gray-700'}`}>
                  {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {canReply && (
        <div className={`px-4 py-3 border-t ${isAwaiting ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' : 'border-gray-100 dark:border-gray-700/60'}`}>
          {isAwaiting && (
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-2">
              📋 The agent is waiting for your response. Please reply below.
            </p>
          )}
          <div className="flex gap-2">
            <input value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={isAwaiting ? 'Provide the requested information…' : 'Add a message or update…'}
              className={`flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none bg-white dark:bg-[#0d1117] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 transition-all ${
                isAwaiting
                  ? 'border-amber-300 dark:border-amber-500/40 focus:border-amber-400 dark:focus:border-amber-400'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-cyan-500/50'
              }`} />
            <button onClick={send} disabled={sending || !reply.trim()}
              className="px-4 py-2 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-gray-900 rounded-xl text-sm font-semibold dark:font-bold disabled:opacity-40 transition-colors">
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Reopen ──────────────────────────────────────────────────────── */
function ReopenComplaint({ complaint, onReopen }) {
  const [show,    setShow]    = useState(false)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)

  if (!['Resolved', 'Closed'].includes(complaint.status)) return null
  if (!complaint.resolved_at) return null
  const daysSince = (new Date() - new Date(complaint.resolved_at)) / 86400000
  if (daysSince > 7) return null

  const submit = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try { await api.post(`/api/complaints/${complaint.complaint_id}/reopen`, { reason }); onReopen && onReopen() }
    catch (e) { alert(e.response?.data?.detail || 'Failed to reopen') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-4">
      <p className="text-xs text-orange-700 dark:text-orange-300 mb-2">
        ⚠️ Issue not resolved? You can reopen within 7 days of resolution.
        <span className="ml-1 text-orange-500">({Math.ceil(7 - daysSince)} days left)</span>
      </p>
      {!show ? (
        <button onClick={() => setShow(true)} className="text-xs font-semibold text-orange-700 dark:text-orange-400 underline hover:text-orange-900 dark:hover:text-orange-300">
          Reopen this complaint
        </button>
      ) : (
        <div className="space-y-2 mt-2">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Describe why the issue is still unresolved…"
            className="w-full text-xs border border-orange-300 dark:border-orange-500/30 rounded-lg px-3 py-2 resize-none focus:outline-none bg-white dark:bg-[#0d1117] text-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={!reason.trim() || loading}
              className="px-3 py-1.5 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-400 text-white dark:text-gray-900 text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
              {loading ? '…' : 'Reopen'}
            </button>
            <button onClick={() => setShow(false)} className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function UserComplaintDetail() {
  const { complaintId } = useParams()
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const [complaint, setComplaint] = useState(null)
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)

  const refresh = () => {
    Promise.all([
      api.get(`/api/complaints/${complaintId}`),
      api.get(`/api/complaints/${complaintId}/history`),
    ]).then(([c, h]) => { setComplaint(c.data); setHistory(h.data || []) })
  }

  useEffect(() => {
    Promise.all([
      api.get(`/api/complaints/${complaintId}`),
      api.get(`/api/complaints/${complaintId}/history`),
    ])
      .then(([c, h]) => { setComplaint(c.data); setHistory(h.data || []) })
      .catch(() => navigate('/my-complaints'))
      .finally(() => setLoading(false))
  }, [complaintId])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center"><div className="text-4xl mb-2 animate-bounce">📦</div><p>Loading your complaint…</p></div>
    </div>
  )
  if (!complaint) return null

  const date = complaint.created_at
    ? new Date(complaint.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/my-complaints')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl transition-colors">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-500">{complaint.complaint_id}</span>
            {complaint.sla_breached && (
              <span className="text-xs font-bold bg-red-100 dark:bg-rose-500/15 text-red-700 dark:text-rose-400 border dark:border-rose-500/30 px-2 py-0.5 rounded-full">🚨 Being handled urgently</span>
            )}
            {complaint.status === 'Awaiting Response' && (
              <span className="text-xs font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border dark:border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">💬 Response Needed</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Submitted {date}</p>
        </div>
      </div>

      <div className="space-y-4 mb-4">
        <ExpectedResolutionBanner complaint={complaint} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <StatusTracker complaint={complaint} history={history} />

          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Your Complaint</h3>
            <p className="text-gray-800 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{complaint.complaint_text}</p>
            {complaint.category && (
              <span className="inline-block mt-3 bg-indigo-50 dark:bg-violet-500/15 text-indigo-700 dark:text-violet-400 dark:border dark:border-violet-500/30 text-xs px-2 py-0.5 rounded-full font-medium">{complaint.category}</span>
            )}
          </div>

          {complaint.image_path && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Attached Photo</h3>
              <img src={`http://localhost:8001/uploads/${complaint.image_path}`} alt="Complaint attachment"
                className="rounded-xl max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-sm dark:border dark:border-gray-700/40"
                onClick={() => window.open(`http://localhost:8001/uploads/${complaint.image_path}`, '_blank')} />
            </div>
          )}

          <ReopenComplaint complaint={complaint} onReopen={refresh} />
          <SatisfactionRating complaint={complaint} onRated={refresh} />
        </div>

        <div>
          <ResolutionNotes complaint={complaint} onReply={refresh} />
        </div>
      </div>
    </div>
  )
}
