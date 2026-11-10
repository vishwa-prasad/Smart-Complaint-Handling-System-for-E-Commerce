import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

const ROLE_COLOR = {
  admin:    'bg-purple-100 text-purple-700',
  employee: 'bg-blue-100 text-blue-700',
}

function Stars({ value }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>
  const full = Math.round(value)
  return (
    <span title={`${value} / 5`}>
      {'★'.repeat(full)}<span className="text-gray-200">{'★'.repeat(5 - full)}</span>
      <span className="text-xs text-gray-500 ml-1">({value})</span>
    </span>
  )
}

function StatCell({ value, unit = '', color = 'text-gray-800' }) {
  if (value === null || value === undefined)
    return <span className="text-gray-300 text-sm">—</span>
  return (
    <span className={`font-semibold text-sm ${color}`}>
      {value}{unit}
    </span>
  )
}

export default function AdminPerformance() {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.get('/api/admin/performance')
      .then((r) => setAgents(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load performance data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">
      <div className="text-3xl mb-2 animate-spin inline-block">⚙️</div>
      <p>Loading performance data…</p>
    </div>
  )

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-red-500">{error}</div>
  )

  const totalResolved = agents.reduce((s, a) => s + a.resolved, 0)
  const bestResolver  = agents.reduce((best, a) => (!best || a.resolved > best.resolved) ? a : best, null)
  const fastestResp   = agents.filter(a => a.avg_response_hrs !== null)
    .reduce((best, a) => (!best || a.avg_response_hrs < best.avg_response_hrs) ? a : best, null)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">


      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resolution times, response times, and satisfaction ratings per agent</p>
        </div>
        <Link to="/admin/workload" className="btn-secondary text-sm">← Workload View</Link>
      </div>


      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalResolved}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Resolved</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-base font-bold text-blue-600 truncate">{bestResolver?.name || '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Most Resolved ({bestResolver?.resolved ?? 0})</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-base font-bold text-indigo-600 truncate">{fastestResp?.name || '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Fastest Response ({fastestResp ? fastestResp.avg_response_hrs + 'h' : '—'})</p>
        </div>
      </div>


      {agents.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-medium">No agents found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Agent', 'Role', 'Total', 'Open', 'Resolved', 'Avg Response', 'Avg Resolution', 'Satisfaction'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{agent.name}</p>
                          <p className="text-xs text-gray-400">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[agent.role] || 'bg-gray-100 text-gray-600'}`}>
                        {agent.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatCell value={agent.total} />
                    </td>
                    <td className="px-5 py-4">
                      <StatCell value={agent.open} color={agent.open > 10 ? 'text-red-600' : 'text-amber-600'} />
                    </td>
                    <td className="px-5 py-4">
                      <StatCell value={agent.resolved} color="text-green-600" />
                    </td>
                    <td className="px-5 py-4">
                      <StatCell
                        value={agent.avg_response_hrs}
                        unit="h"
                        color={
                          agent.avg_response_hrs === null ? '' :
                          agent.avg_response_hrs <= 2  ? 'text-green-600' :
                          agent.avg_response_hrs <= 12 ? 'text-amber-600' :
                                                          'text-red-600'
                        }
                      />
                    </td>
                    <td className="px-5 py-4">
                      <StatCell
                        value={agent.avg_resolution_hrs}
                        unit="h"
                        color={
                          agent.avg_resolution_hrs === null ? '' :
                          agent.avg_resolution_hrs <= 24 ? 'text-green-600' :
                          agent.avg_resolution_hrs <= 72 ? 'text-amber-600' :
                                                            'text-red-600'
                        }
                      />
                    </td>
                    <td className="px-5 py-4 text-yellow-500">
                      <Stars value={agent.avg_satisfaction} />
                      {agent.ratings_count > 0 && (
                        <span className="text-xs text-gray-400 ml-1">({agent.ratings_count})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">
        Response time = from complaint submission to agent's first action.
        Resolution time = from submission to status "Resolved". Sorted by complaints resolved.
      </p>
    </div>
  )
}
