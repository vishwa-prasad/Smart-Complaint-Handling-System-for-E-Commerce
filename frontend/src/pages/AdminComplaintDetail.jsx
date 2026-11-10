import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const STATUSES   = ['Open', 'In Progress', 'Awaiting Response', 'Escalated', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Medium', 'High']

const PRIORITY_COLORS = {
  High:   'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:    'bg-green-100 text-green-700 border-green-200',
}
const STATUS_COLORS = {
  'Open':              'bg-blue-100 text-blue-700',
  'In Progress':       'bg-purple-100 text-purple-700',
  'Awaiting Response': 'bg-amber-100 text-amber-700',
  'Escalated':         'bg-red-100 text-red-700',
  'Resolved':          'bg-green-100 text-green-700',
  'Closed':            'bg-gray-100 text-gray-700',
}

const SLA_HOURS = { High: 24, Medium: 48, Low: 72 }

function SLABadge({ complaint }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!complaint.sla_deadline || ['Resolved','Closed'].includes(complaint.status)) return
    const update = () => {
      const diff = new Date(complaint.sla_deadline) - new Date()
      setRemaining(diff)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [complaint.sla_deadline, complaint.status])

  if (['Resolved','Closed'].includes(complaint.status)) {
    return <span className="text-xs text-green-600 font-semibold">✅ Resolved</span>
  }
  if (complaint.sla_breached || (remaining !== null && remaining <= 0)) {
    return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">🚨 SLA Breached</span>
  }
  if (complaint.status === 'Awaiting Response') {
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏸ SLA Paused</span>
  }
  if (remaining === null || !complaint.sla_deadline) return null

  const hrs = Math.floor(remaining / 3600000)
  const mins = Math.floor((remaining % 3600000) / 60000)
  const isUrgent = remaining < 3600000 * 4
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
      ⏱ {hrs}h {mins}m left
    </span>
  )
}

function ResolutionNotesFeed({ complaint, onUpdate }) {
  const [notes, setNotes] = useState([])
  const [note, setNote] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const fetchNotes = async () => {
    try {
      const res = await api.get(`/api/complaints/${complaint.complaint_id}/notes`)
      setNotes(res.data || [])
    } catch {}
  }

  useEffect(() => { fetchNotes() }, [complaint.complaint_id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [notes])

  const send = async () => {
    if (!note.trim()) return
    setSending(true)
    try {
      await api.post(`/api/complaints/${complaint.complaint_id}/notes`, { note: note.trim(), is_internal: isInternal })
      setNote('')
      await fetchNotes()
      onUpdate && onUpdate()
    } catch (e) { alert(e.response?.data?.detail || 'Failed to send') }
    finally { setSending(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">💬 Updates & Notes</h3>
        <span className="text-xs text-gray-400">{notes.length} entries</span>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-3 max-h-72">
        {notes.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No updates posted yet.</p>}
        {notes.map(n => {
          const isAgent = n.author_role !== 'user'
          return (
            <div key={n.id} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm ${
                n.is_internal
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-tl-sm'
                  : isAgent
                  ? 'bg-indigo-50 text-indigo-900 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-xs font-semibold ${n.is_internal ? 'text-yellow-700' : isAgent ? 'text-indigo-600' : 'text-blue-200'}`}>
                    {n.author_name} ({n.author_role}){n.is_internal ? ' 🔒' : ''}
                  </span>
                </div>
                <p className="leading-relaxed">{n.note}</p>
                <p className={`text-xs mt-1 ${n.is_internal ? 'text-yellow-500' : isAgent ? 'text-indigo-400' : 'text-blue-300'}`}>
                  {new Date(n.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {!['Resolved','Closed'].includes(complaint.status) && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!isInternal} onChange={() => setIsInternal(false)} className="rounded" />
              <span>Customer visible</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={() => setIsInternal(true)} className="rounded" />
              <span>🔒 Internal only</span>
            </label>
          </div>
          <div className="flex gap-2">
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={isInternal ? 'Internal note (not visible to customer)…' : 'Update visible to customer…'}
              className={`flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 ${isInternal ? 'bg-yellow-50 border-yellow-300' : 'border-gray-200'}`} />
            <button onClick={send} disabled={sending || !note.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 transition-colors">
              {sending ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestInfoModal({ complaint, onClose, onSuccess }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!message.trim()) return
    setLoading(true)
    try {
      await api.post(`/api/complaints/${complaint.complaint_id}/request-info`, { message })
      onSuccess && onSuccess()
      onClose()
    } catch (e) { alert(e.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-bold text-gray-800 mb-1">📋 Request More Information</h3>
        <p className="text-xs text-gray-500 mb-4">The customer will be notified by email. SLA timer will pause until they respond.</p>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
          placeholder="What additional information do you need from the customer?"
          className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 mb-4 resize-none focus:outline-none focus:border-amber-400" />
        <div className="flex gap-3">
          <button onClick={submit} disabled={!message.trim() || loading}
            className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-amber-600 transition-colors">
            {loading ? 'Sending…' : 'Send Request & Pause SLA'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminComplaintDetail() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [agents, setAgents] = useState([])
  const [cannedList, setCannedList] = useState([])
  const [showCanned, setShowCanned] = useState(false)
  const [newCanned, setNewCanned] = useState({ title: '', body: '' })
  const [addingCanned, setAddingCanned] = useState(false)
  const [showRequestInfo, setShowRequestInfo] = useState(false)

  const [form, setForm] = useState({
    status: '', priority: '', resolution_note: '', internal_note: '', assigned_to_id: null,
  })

  const refresh = async () => {
    try {
      const res = await api.get(`/api/complaints/${complaintId}`)
      setComplaint(res.data)
      setForm(f => ({ ...f, status: res.data.status, priority: res.data.priority }))
    } catch {}
  }

  useEffect(() => {
    api.get('/api/admin/canned-responses').then(r => setCannedList(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([api.get(`/api/complaints/${complaintId}`), api.get('/api/admin/agents')])
      .then(([cRes, aRes]) => {
        setComplaint(cRes.data)
        setAgents(aRes.data)
        setForm({
          status: cRes.data.status, priority: cRes.data.priority,
          resolution_note: cRes.data.resolution_note || '',
          internal_note: cRes.data.internal_note || '',
          assigned_to_id: cRes.data.assigned_to_id || null,
        })
      })
      .catch(() => navigate('/admin/complaints'))
      .finally(() => setLoading(false))
  }, [complaintId])

  const insertCanned = (body) => {
    setForm(f => ({ ...f, resolution_note: f.resolution_note ? f.resolution_note + '\n' + body : body }))
    setShowCanned(false)
  }

  const saveCanned = async () => {
    if (!newCanned.title.trim() || !newCanned.body.trim()) return
    setAddingCanned(true)
    try {
      const res = await api.post('/api/admin/canned-responses', { title: newCanned.title, body: newCanned.body, category: complaint?.category || null })
      setCannedList(prev => [...prev, res.data])
      setNewCanned({ title: '', body: '' })
    } catch {} finally { setAddingCanned(false) }
  }

  const deleteCanned = async (id) => {
    await api.delete(`/api/admin/canned-responses/${id}`)
    setCannedList(prev => prev.filter(c => c.id !== id))
  }

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const payload = { ...form, assigned_to_id: form.assigned_to_id ? parseInt(form.assigned_to_id) : null }
      const res = await api.patch(`/api/admin/complaints/${complaintId}`, payload)
      setComplaint(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      const detail = err.response?.data?.detail
      alert(!detail ? 'Update failed' : typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join(', ') : JSON.stringify(detail))
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center"><div className="text-3xl animate-spin inline-block mb-2">⚙️</div><p>Loading complaint...</p></div>
    </div>
  )
  if (!complaint) return null

  const date = complaint.created_at
    ? new Date(complaint.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—'
  const resolvedDate = complaint.resolved_at
    ? new Date(complaint.resolved_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {showRequestInfo && (
        <RequestInfoModal complaint={complaint} onClose={() => setShowRequestInfo(false)} onSuccess={refresh} />
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/complaints')} className="text-gray-400 hover:text-gray-600 transition-colors text-xl">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-500">{complaint.complaint_id}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[complaint.priority]}`}>{complaint.priority}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[complaint.status] || 'bg-gray-100 text-gray-700'}`}>{complaint.status}</span>
            <SLABadge complaint={complaint} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Submitted {date}</p>
        </div>
        {!['Resolved','Closed'].includes(complaint.status) && (
          <button onClick={() => setShowRequestInfo(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm">
            📋 Request More Info
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Customer</h3>
            <p className="font-semibold text-gray-800">{complaint.owner?.name || '—'}</p>
            <p className="text-sm text-gray-500">{complaint.owner?.email || '—'}</p>
          </div>

          <div className="bg-teal-50 rounded-xl border border-teal-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">👤 Assigned Agent</h3>
            {complaint.assigned_to ? (
              <div>
                <p className="font-semibold text-gray-800">{complaint.assigned_to.name}</p>
                <p className="text-xs text-gray-500">{complaint.assigned_to.email}</p>
                <span className="inline-block mt-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full capitalize">{complaint.assigned_to.role}</span>
              </div>
            ) : <p className="text-sm text-gray-400 italic">Not assigned yet</p>}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Details</h3>
            <div><p className="text-xs text-gray-400">Category</p>
              <span className="inline-block mt-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">{complaint.category || '—'}</span>
            </div>
            <div><p className="text-xs text-gray-400">Channel</p><p className="text-sm text-gray-700 font-medium">{complaint.channel || 'Web Form'}</p></div>
            <div>
              <p className="text-xs text-gray-400">SLA Deadline</p>
              {complaint.sla_deadline
                ? <p className="text-sm text-gray-700">{new Date(complaint.sla_deadline).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                : <p className="text-sm text-gray-400">—</p>}
            </div>
            <div><p className="text-xs text-gray-400">SLA Status</p>
              <p className={`text-sm font-semibold ${complaint.sla_breached ? 'text-red-600' : 'text-green-600'}`}>
                {complaint.sla_breached ? '⚠️ Breached' : '✅ Within SLA'}
              </p>
            </div>
            {resolvedDate && <div><p className="text-xs text-gray-400">Resolved At</p><p className="text-sm text-gray-700">{resolvedDate}</p></div>}
            {complaint.satisfaction_rating && (
              <div>
                <p className="text-xs text-gray-400">Customer Rating</p>
                <p className="text-yellow-500 text-base">
                  {'★'.repeat(complaint.satisfaction_rating)}<span className="text-gray-300">{'★'.repeat(5 - complaint.satisfaction_rating)}</span>
                </p>
                {complaint.satisfaction_comment && <p className="text-xs text-gray-500 mt-1 italic">"{complaint.satisfaction_comment}"</p>}
              </div>
            )}
            {complaint.reopened_at && (
              <div><p className="text-xs text-orange-500 font-semibold">🔄 Reopened by customer</p></div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Complaint</h3>
            <p className="text-gray-800 leading-relaxed text-base whitespace-pre-wrap">{complaint.complaint_text}</p>
            {complaint.image_path && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attached Photo</p>
                <img src={`http://localhost:8001/uploads/${complaint.image_path}`} alt="Complaint attachment"
                  className="rounded-xl max-h-72 object-cover border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(`http://localhost:8001/uploads/${complaint.image_path}`, '_blank')} />
                <p className="text-xs text-gray-400 mt-1">Click to open full size</p>
              </div>
            )}
          </div>

          <ResolutionNotesFeed complaint={complaint} onUpdate={refresh} />

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin Actions</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="input-field w-full" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select className="input-field w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">👤 Assign To Agent</label>
              <select className="input-field w-full" value={form.assigned_to_id || ''} onChange={e => setForm({ ...form, assigned_to_id: e.target.value ? parseInt(e.target.value) : null })}>
                <option value="">— Unassigned —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">📢 Resolution Note <span className="text-xs text-gray-400 font-normal">(visible to customer)</span></label>
                <button type="button" onClick={() => setShowCanned(v => !v)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  💬 Canned {showCanned ? '▲' : '▼'}
                </button>
              </div>
              {showCanned && (
                <div className="mb-2 border border-blue-100 rounded-xl bg-blue-50 p-3 space-y-2">
                  {cannedList.length === 0 && <p className="text-xs text-gray-400 italic">No saved responses yet.</p>}
                  {cannedList.map(cr => (
                    <div key={cr.id} className="flex items-start justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{cr.title}</p>
                        <p className="text-xs text-gray-500 truncate">{cr.body}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => insertCanned(cr.body)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700">Insert</button>
                        <button onClick={() => deleteCanned(cr.id)} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-blue-100 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500">Save new response</p>
                    <input type="text" placeholder="Title" className="input-field text-xs py-1.5 w-full" value={newCanned.title} onChange={e => setNewCanned(n => ({ ...n, title: e.target.value }))} />
                    <textarea rows={2} placeholder="Response body…" className="input-field text-xs py-1.5 w-full resize-none" value={newCanned.body} onChange={e => setNewCanned(n => ({ ...n, body: e.target.value }))} />
                    <button onClick={saveCanned} disabled={addingCanned || !newCanned.title || !newCanned.body} className="text-xs btn-primary py-1.5 px-3 disabled:opacity-50">
                      {addingCanned ? 'Saving…' : '+ Save'}
                    </button>
                  </div>
                </div>
              )}
              <textarea rows={4} className="input-field w-full resize-y" placeholder="Explain how this complaint is being resolved…" value={form.resolution_note} onChange={e => setForm({ ...form, resolution_note: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🔒 Internal Note <span className="text-xs text-gray-400 font-normal">(admin only)</span></label>
              <textarea rows={3} className="input-field w-full resize-y bg-yellow-50 border-yellow-200 focus:border-yellow-400" placeholder="Private notes for the team…" value={form.internal_note} onChange={e => setForm({ ...form, internal_note: e.target.value })} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleSave} disabled={saving} className="btn-primary px-6">
                {saving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
              {saved && <span className="text-green-600 text-sm font-medium animate-pulse">✅ Saved</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
