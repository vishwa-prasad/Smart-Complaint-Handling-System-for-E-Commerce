import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, PieChart, Pie, Legend,
} from 'recharts'
import api from '../api/axios'

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1']
const PRIORITY_COLORS = { High: '#f97316', Medium: '#eab308', Low: '#22c55e' }

export default function Analytics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/analytics')
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading analytics...</div>
  if (!stats) return <div className="text-center py-20 text-red-500">Failed to load analytics</div>

  const resolutionRate = stats.total_complaints
    ? Math.round((stats.resolved_count / stats.total_complaints) * 100)
    : 0

  const categoryData = Object.entries(stats.category_breakdown || {})
    .map(([name, value], i) => ({ name, value, fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
    .sort((a, b) => b.value - a.value)

  const priorityData = [
    { name: 'High', value: stats.high_priority },
    { name: 'Medium', value: stats.medium_priority },
    { name: 'Low', value: stats.low_priority },
  ]

  const statusData = [
    { name: 'Open', value: stats.open_count, fill: '#3b82f6' },
    { name: 'In Progress', value: stats.in_progress_count, fill: '#8b5cf6' },
    { name: 'Escalated', value: stats.escalated_count, fill: '#ef4444' },
    { name: 'Resolved', value: stats.resolved_count, fill: '#22c55e' },
  ].filter(d => d.value > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
      <p className="text-gray-500 text-sm mb-8">Complaint intelligence dashboard</p>


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPICard label="Total Complaints" value={stats.total_complaints} icon="📊" sub="All time" />
        <KPICard label="Resolution Rate" value={`${resolutionRate}%`} icon="✅" sub={`${stats.resolved_count} resolved`} />
        <KPICard label="Escalated" value={stats.escalated_count} icon="🚨" sub="Needs attention" color="text-red-600" />
        <KPICard label="High Priority" value={stats.high_priority} icon="⚠️" sub="Needs attention" color="text-orange-600" />
        <KPICard
          label="SLA Breached"
          value={stats.sla_breached_count}
          icon="⏰"
          sub="Open > 3 days"
          color={stats.sla_breached_count > 0 ? 'text-red-600' : 'text-gray-700'}
        />
        <KPICard
          label="Avg Satisfaction"
          value={stats.avg_satisfaction ? `${stats.avg_satisfaction}/5` : '—'}
          icon="⭐"
          sub="User ratings"
          color="text-yellow-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Complaints by Category</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>


        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


      <div className="card mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Priority Distribution</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={priorityData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {priorityData.map((entry) => (
                <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>


      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Category Summary</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-500 font-medium">Category</th>
              <th className="text-right py-2 text-gray-500 font-medium">Count</th>
              <th className="text-right py-2 text-gray-500 font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categoryData.map((c) => (
              <tr key={c.name}>
                <td className="py-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: c.fill }} />
                  {c.name}
                </td>
                <td className="py-2 text-right font-semibold">{c.value}</td>
                <td className="py-2 text-right text-gray-500">
                  {stats.total_complaints ? Math.round((c.value / stats.total_complaints) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, sub, color = 'text-gray-900' }) {
  return (
    <div className="card">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-3xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  )
}
