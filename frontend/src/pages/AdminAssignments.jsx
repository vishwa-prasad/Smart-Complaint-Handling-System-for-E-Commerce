import { useState, useEffect } from 'react'
import api from '../api/axios'

const CATEGORY_ICONS = {
  'Delivery Issue':   '🚚',
  'Payment Issue':    '💳',
  'Product Issue':    '📦',
  'Account Issue':    '🔐',
  'Refund Request':   '💰',
  'Customer Service': '🎧',
}

export default function AdminAssignments() {
  const [categoryAgents, setCategoryAgents] = useState([])
  const [agents,         setAgents]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState({})
  const [saved,          setSaved]          = useState({})

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/category-agents'),
      api.get('/api/admin/agents'),
    ]).then(([caRes, gRes]) => {
      setCategoryAgents(caRes.data)
      setAgents(gRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async (category, selectedIds) => {
    setSaving((s) => ({ ...s, [category]: true }))
    setSaved((s)  => ({ ...s, [category]: false }))
    try {
      const res = await api.put(
        `/api/admin/category-agents/${encodeURIComponent(category)}`,
        { user_ids: selectedIds }
      )
      setCategoryAgents((prev) =>
        prev.map((ca) => ca.category === category ? res.data : ca)
      )
      setSaved((s) => ({ ...s, [category]: true }))
      setTimeout(() => setSaved((s) => ({ ...s, [category]: false })), 2500)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving((s) => ({ ...s, [category]: false }))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="text-3xl animate-spin inline-block mb-2">⚙️</div>
        <p>Loading assignments...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Category → Agent Assignment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign one or more agents per category. New complaints are auto-routed to the agent with the fewest open cases.
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium">⚠️ No agents available</p>
          <p className="text-xs text-amber-600 mt-1">
            Go to <strong>User Management</strong> and set a user's role to <strong>Employee</strong> or <strong>Admin</strong>.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Available Agents ({agents.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <span key={a.id}
                className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs px-3 py-1 rounded-full border border-teal-100 font-medium">
                <span className="w-5 h-5 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center text-xs font-bold">
                  {a.name[0].toUpperCase()}
                </span>
                {a.name}
                <span className="text-teal-400 capitalize">· {a.role}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {categoryAgents.map((ca) => (
          <CategoryRow
            key={ca.category}
            ca={ca}
            agents={agents}
            saving={!!saving[ca.category]}
            saved={!!saved[ca.category]}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  )
}


function CategoryRow({ ca, agents, saving, saved, onSave }) {
  const [selectedIds, setSelectedIds] = useState(
    (ca.agents || []).map((a) => a.id)
  )
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setSelectedIds((ca.agents || []).map((a) => a.id))
  }, [ca.agents])

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const icon          = CATEGORY_ICONS[ca.category] || '📋'
  const currentNames  = (ca.agents || []).map((a) => a.name)
  const isDirty       = JSON.stringify([...selectedIds].sort()) !==
                        JSON.stringify([...(ca.agents || []).map(a => a.id)].sort())

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">
      <div className="flex items-center gap-4 px-6 py-4">

        {/* Category name */}
        <div className="flex items-center gap-2 w-44 shrink-0">
          <span className="text-xl">{icon}</span>
          <span className="font-medium text-gray-800 text-sm">{ca.category}</span>
        </div>

        {/* Currently assigned pills */}
        <div className="flex-1 flex flex-wrap gap-1.5 min-h-[28px]">
          {selectedIds.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No agents assigned</span>
          ) : (
            agents
              .filter((a) => selectedIds.includes(a.id))
              .map((a) => (
                <span key={a.id}
                  className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full border border-indigo-100 font-medium">
                  {a.name}
                  <button
                    onClick={() => toggle(a.id)}
                    className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors font-bold"
                  >×</button>
                </span>
              ))
          )}
        </div>

        {/* Add button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-all"
          >
            + Add Agent
          </button>

          {open && (
            <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-56 py-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-3 py-2">
                Select agents
              </p>
              {agents.map((a) => {
                const checked = selectedIds.includes(a.id)
                return (
                  <label key={a.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0">
                      {a.name[0].toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm text-gray-700 font-medium leading-tight">{a.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{a.role}</p>
                    </div>
                  </label>
                )
              })}
              <div className="border-t border-gray-100 mt-1 px-3 py-2">
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >Done</button>
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="shrink-0 w-20 text-right">
          {saved ? (
            <span className="text-green-600 text-xs font-medium">✅ Saved</span>
          ) : (
            <button
              onClick={() => { onSave(ca.category, selectedIds); setOpen(false) }}
              disabled={saving || !isDirty}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                isDirty
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? '⏳' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
