import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const STATUSES = ['Open', 'In Progress', 'Escalated', 'Resolved']
const PRIORITIES = ['Low', 'Medium', 'High']

export default function AdminComplaints() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const isEmployee = user?.role === 'employee'
  const [complaints, setComplaints] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', priority: '', search: '', sla: '' })
  const [page, setPage] = useState(0)
  const limit = 15
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkPriority, setBulkPriority] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchComplaints = () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('skip', page * limit)
    params.set('limit', limit)
    if (filters.status) params.set('status', filters.status)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.search) params.set('search', filters.search)
    if (filters.sla === 'breached') params.set('sla_breached', 'true')

    api.get(`/api/admin/complaints?${params}`)
      .then((r) => { setComplaints(r.data.items || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchComplaints() }, [page, filters])

  const openEdit = (c) => {
    setEditing(c.complaint_id)
    setEditForm({
      status: c.status,
      priority: c.priority,
      resolution_note: c.resolution_note || '',
      internal_note: c.internal_note || '',
    })
  }

  const saveEdit = async (complaintId) => {
    setSaving(true)
    try {
      await api.patch(`/api/admin/complaints/${complaintId}`, editForm)
      setEditing(null)
      fetchComplaints()
    } catch (err) {
      alert(err.response?.data?.detail || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === complaints.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(complaints.map((c) => c.complaint_id)))
    }
  }

  const handleBulkUpdate = async () => {
    if (!selected.size) return
    if (!bulkStatus && !bulkPriority) return alert('Choose a status or priority to apply.')
    setBulkSaving(true)
    try {
      const res = await api.post('/api/admin/complaints/bulk', {
        complaint_ids: [...selected],
        status:   bulkStatus   || null,
        priority: bulkPriority || null,
      })
      setSelected(new Set())
      setBulkStatus('')
      setBulkPriority('')
      fetchComplaints()
      alert(`Updated ${res.data.updated} complaint(s).`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Bulk update failed')
    } finally {
      setBulkSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get('/api/admin/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `complaints_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const slaBreach = complaints.filter(c => c.sla_breached).length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">


      {isEmployee && (
        <div className="mb-5 bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-2xl">👤</span>
          <div>
            <p className="font-semibold text-teal-800 text-sm">My Queue — {user.name}</p>
            <p className="text-xs text-teal-600">Showing only complaints assigned to you. Contact the main admin to update your category assignments.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEmployee ? 'My Assigned Complaints' : 'All Complaints'}
          </h1>
          <p className="text-sm text-gray-500">
            {total} total
            {slaBreach > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                ⚠️ {slaBreach} SLA Breached
              </span>
            )}
          </p>
        </div>
        {!isEmployee && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary flex items-center gap-2"
          >
            {exporting ? '⏳ Exporting...' : '📥 Export CSV'}
          </button>
        )}
      </div>


      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <select
            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            <option value="">Set status…</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select
            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
            value={bulkPriority}
            onChange={(e) => setBulkPriority(e.target.value)}
          >
            <option value="">Set priority…</option>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <button
            onClick={handleBulkUpdate}
            disabled={bulkSaving || (!bulkStatus && !bulkPriority)}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {bulkSaving ? 'Saving…' : 'Apply'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
        </div>
      )}


      <div className="card mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search text..."
          className="input-field max-w-xs"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select className="input-field max-w-[160px]" value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input-field max-w-[160px]" value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="input-field max-w-[160px]" value={filters.sla}
          onChange={(e) => setFilters({ ...filters, sla: e.target.value })}>
          <option value="">All SLA</option>
          <option value="breached">⚠️ SLA Breached</option>
        </select>
        <button onClick={() => { setFilters({ status: '', priority: '', search: '', sla: '' }); setPage(0) }}
          className="btn-secondary text-sm">Clear</button>
      </div>


      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === complaints.length && complaints.length > 0}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    {['ID', 'User', 'Complaint', 'Category', 'Priority', 'Status', 'SLA', 'Rating', 'Date', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {complaints.map((c) => (
                    <React.Fragment key={c.complaint_id}>
                      <tr className={`hover:bg-gray-50 transition-colors ${c.sla_breached ? 'bg-red-50' : ''} ${selected.has(c.complaint_id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(c.complaint_id)}
                            onChange={() => toggleSelect(c.complaint_id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.complaint_id}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{c.owner?.name || '—'}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-gray-700">{c.complaint_text}</p>
                        </td>
                        <td className="px-4 py-3">
                          {c.category && (
                            <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {c.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            c.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            c.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'}`}>
                            {c.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            c.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                            c.status === 'Escalated' ? 'bg-red-100 text-red-700' :
                            c.status === 'In Progress' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.sla_breached ? (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">⚠️ BREACHED</span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">✅ OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.satisfaction_rating ? (
                            <span className="text-yellow-500">{'⭐'.repeat(c.satisfaction_rating)}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/admin/complaints/${c.complaint_id}`)}
                              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Open →
                            </button>
                            <button onClick={() => editing === c.complaint_id ? setEditing(null) : openEdit(c)}
                              className="text-blue-600 hover:underline text-xs font-medium">
                              {editing === c.complaint_id ? 'Cancel' : 'Quick Edit'}
                            </button>
                          </div>
                        </td>
                      </tr>


                      {editing === c.complaint_id && (
                        <tr className="bg-blue-50">
                          <td colSpan={11} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div className="flex gap-3">
                                <div>
                                  <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                                  <select className="input-field text-sm" value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
                                  <select className="input-field text-sm" value={editForm.priority}
                                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">
                                  📢 Resolution Note <span className="text-gray-400">(visible to user)</span>
                                </label>
                                <input type="text" className="input-field text-sm"
                                  placeholder="Message shown to user..."
                                  value={editForm.resolution_note}
                                  onChange={(e) => setEditForm({ ...editForm, resolution_note: e.target.value })} />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">
                                  🔒 Internal Note <span className="text-gray-400">(admin only)</span>
                                </label>
                                <input type="text" className="input-field text-sm"
                                  placeholder="Private admin notes..."
                                  value={editForm.internal_note}
                                  onChange={(e) => setEditForm({ ...editForm, internal_note: e.target.value })} />
                              </div>
                            </div>
                            <button onClick={() => saveEdit(c.complaint_id)} disabled={saving}
                              className="btn-primary text-sm">
                              {saving ? 'Saving...' : '💾 Save Changes'}
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-secondary text-sm px-3 py-1.5">← Prev</button>
              <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total} className="btn-secondary text-sm px-3 py-1.5">Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
