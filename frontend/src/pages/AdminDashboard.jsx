import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  Open: '#3b82f6',
  'In Progress': '#8b5cf6',
  Escalated: '#ef4444',
  Resolved: '#22c55e',
}
const PRIORITY_COLORS = {
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)


  if (user?.role === 'employee') {
    return <Navigate to="/admin/complaints" replace />
  }

  useEffect(() => {
    api.get('/api/admin/analytics')
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading analytics...</div>
  }

  if (!stats) {
    return <div className="text-center text-red-500 py-8">Failed to load analytics</div>
  }

  const statusData = [
    { name: 'Open', value: stats.open_count },
    { name: 'In Progress', value: stats.in_progress_count },
    { name: 'Escalated', value: stats.escalated_count },
    { name: 'Resolved', value: stats.resolved_count },
  ].filter(d => d.value > 0)

  const priorityData = [
    { name: 'High', value: stats.high_priority, fill: PRIORITY_COLORS.High },
    { name: 'Medium', value: stats.medium_priority, fill: PRIORITY_COLORS.Medium },
    { name: 'Low', value: stats.low_priority, fill: PRIORITY_COLORS.Low },
  ]

  const categoryData = Object.entries(stats.category_breakdown || {}).map(([name, value]) => ({ name, value }))

  const summaryCards = [
    { label: 'Total Complaints', value: stats.total_complaints, icon: '📊', color: 'bg-blue-50 text-blue-700' },
    { label: 'Open', value: stats.open_count, icon: '📂', color: 'bg-indigo-50 text-indigo-700' },
    { label: 'In Progress', value: stats.in_progress_count, icon: '⚙️', color: 'bg-purple-50 text-purple-700' },
    { label: 'Escalated', value: stats.escalated_count, icon: '🚨', color: 'bg-red-50 text-red-700' },
    { label: 'Resolved', value: stats.resolved_count, icon: '✅', color: 'bg-green-50 text-green-700' },
    { label: 'High Priority', value: stats.high_priority, icon: '⚠️', color: 'bg-orange-50 text-orange-700' },
    { label: 'SLA Breached', value: stats.sla_breached_count, icon: '⏰', color: stats.sla_breached_count > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-50 text-gray-600' },
    { label: 'Avg Satisfaction', value: stats.avg_satisfaction ? `${stats.avg_satisfaction} ⭐` : '—', icon: '😊', color: 'bg-yellow-50 text-yellow-700' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time complaint analytics</p>
        </div>
        <Link to="/admin/complaints" className="btn-primary">View All Complaints →</Link>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        {summaryCards.map((c) => (
          <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs font-medium">{c.label}</div>
          </div>
        ))}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Complaint Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>


        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Priority Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} layout="vertical">
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {categoryData.length > 0 && (
        <div className="card mb-8">
          <h3 className="font-semibold text-gray-800 mb-4">Complaints by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}


      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Recent Complaints</h3>
          <Link to="/admin/complaints" className="text-blue-600 text-sm hover:underline">View all →</Link>
        </div>
        {stats.recent_complaints?.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No complaints yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.recent_complaints?.slice(0, 8).map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-gray-400 mr-2">{c.complaint_id}</span>
                  <span className="text-sm text-gray-700 truncate">{c.complaint_text?.substring(0, 60)}...</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    c.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                    c.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'}`}>{c.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    c.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                    c.status === 'Escalated' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'}`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
