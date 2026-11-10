import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const statConfig = [
  { key: 'Open',        label: 'Open',        icon: '📂',
    light: 'bg-blue-50 border-blue-200 text-blue-700',
    dark:  'dark:bg-[#0a1929] dark:border-cyan-500/40 dark:shadow-[0_0_24px_rgba(6,182,212,0.08)]',
    numDark: 'dark:text-cyan-400', dot: 'dark:bg-cyan-500' },
  { key: 'In Progress', label: 'In Progress',  icon: '⚙️',
    light: 'bg-purple-50 border-purple-200 text-purple-700',
    dark:  'dark:bg-[#100b28] dark:border-violet-500/40 dark:shadow-[0_0_24px_rgba(139,92,246,0.08)]',
    numDark: 'dark:text-violet-400', dot: 'dark:bg-violet-500' },
  { key: 'Escalated',   label: 'Escalated',   icon: '🚨',
    light: 'bg-red-50 border-red-200 text-red-700',
    dark:  'dark:bg-[#1a0810] dark:border-rose-500/40 dark:shadow-[0_0_24px_rgba(244,63,94,0.08)]',
    numDark: 'dark:text-rose-400', dot: 'dark:bg-rose-500' },
  { key: 'Resolved',    label: 'Resolved',    icon: '✅',
    light: 'bg-green-50 border-green-200 text-green-700',
    dark:  'dark:bg-[#051a0f] dark:border-emerald-500/40 dark:shadow-[0_0_24px_rgba(16,185,129,0.08)]',
    numDark: 'dark:text-emerald-400', dot: 'dark:bg-emerald-500' },
]

const statusStyle = {
  Resolved:            'bg-green-100 text-green-800 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border dark:border-emerald-500/30',
  Escalated:           'bg-red-100 text-red-800 dark:bg-rose-500/15 dark:text-rose-400 dark:border dark:border-rose-500/30',
  'In Progress':       'bg-purple-100 text-purple-800 dark:bg-violet-500/15 dark:text-violet-400 dark:border dark:border-violet-500/30',
  'Awaiting Response': 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 dark:border dark:border-amber-500/30',
  Closed:              'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400 dark:border dark:border-gray-500/30',
  Open:                'bg-blue-100 text-blue-800 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border dark:border-cyan-500/30',
}

const priorityStyle = {
  High:   'text-orange-600 bg-orange-50 dark:bg-orange-500/15 dark:text-orange-400',
  Medium: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-500/15 dark:text-yellow-400',
  Low:    'text-green-700 bg-green-50 dark:bg-green-500/15 dark:text-green-400',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    api.get('/api/complaints/my?limit=100')
      .then((r) => setComplaints(r.data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const counts = statConfig.reduce((acc, s) => {
    acc[s.key] = complaints.filter((c) => c.status === s.key).length
    return acc
  }, {})

  const recent = complaints.slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's an overview of your complaints</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statConfig.map((s) => (
          <div key={s.key} className={`rounded-xl border p-4 relative overflow-hidden ${s.light} ${s.dark}`}>
            {/* dark-mode top accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] opacity-0 dark:opacity-60 ${s.dot}`} />
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.numDark}`}>{counts[s.key] || 0}</div>
            <div className="text-sm font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/submit"
          className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-blue-200 hover:border-blue-400 dark:border-cyan-500/30 dark:hover:border-cyan-400/60 dark:bg-[#0a1929] dark:hover:bg-[#0d2040]">
          <span className="text-3xl">✍️</span>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white dark:group-hover:text-cyan-300">Submit New Complaint</div>
            <div className="text-sm text-gray-500">Our AI will categorize it instantly</div>
          </div>
        </Link>
        <Link to="/my-complaints"
          className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer dark:border-gray-700/60 dark:hover:border-gray-600 dark:bg-[#111827] dark:hover:bg-[#1a2535]">
          <span className="text-3xl">📋</span>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">View All Complaints</div>
            <div className="text-sm text-gray-500">{complaints.length} total complaints</div>
          </div>
        </Link>
      </div>

      {/* Recent complaints */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-300 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-blue-500 dark:bg-cyan-500 inline-block" />
          Recent Complaints
        </h2>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 dark:bg-[#111827] dark:border-gray-700/60">
            <div className="text-4xl mb-3">📭</div>
            <p>No complaints yet. <Link to="/submit" className="text-blue-600 dark:text-cyan-400 hover:underline">Submit one now</Link></p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((c) => <RecentRow key={c.id} complaint={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function RecentRow({ complaint }) {
  return (
    <Link to={`/complaint/${complaint.complaint_id}`}
      className="card flex items-center justify-between gap-4 dark:bg-[#111827] dark:border-gray-700/50 hover:shadow-md dark:hover:border-gray-600 dark:hover:bg-[#1a2535] transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-400">{complaint.complaint_id}</span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{complaint.complaint_text}</p>
        {complaint.category && (
          <span className="text-xs text-indigo-600 dark:text-violet-400 font-medium">{complaint.category}</span>
        )}
      </div>
      <div className="shrink-0">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[complaint.status] || statusStyle['Open']}`}>
          {complaint.status}
        </span>
      </div>
    </Link>
  )
}
