import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

const ROLE_LABEL = {
  admin: 'Admin',
  employee: 'Agent',
}

const ROLE_COLOR = {
  admin: 'bg-purple-100 text-purple-700',
  employee: 'bg-blue-100 text-blue-700',
}

function LoadBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full ${color}`}
        style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
      />
    </div>
  )
}

export default function AdminWorkload() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/admin/workload')
      .then((r) => setAgents(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load workload data'))
      .finally(() => setLoading(false))
  }, [])

  const maxOpen = Math.max(...agents.map((a) => a.open), 1)

  const totalOpen     = agents.reduce((s, a) => s + a.open, 0)
  const totalResolved = agents.reduce((s, a) => s + a.resolved, 0)
  const totalHigh     = agents.reduce((s, a) => s + a.high_priority, 0)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-400">
        <div className="text-3xl mb-2 animate-spin inline-block">⚙️</div>
        <p>Loading workload data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Workload</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live overview of open complaints per agent — use this to rebalance assignments
          </p>
        </div>
        <Link to="/admin/assignments" className="btn-primary text-sm">
          Manage Assignments
        </Link>
      </div>


      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{agents.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Agents</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{totalOpen}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Open / In Progress</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{totalHigh}</p>
          <p className="text-xs text-gray-500 mt-0.5">High Priority Open</p>
        </div>
      </div>


      {agents.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-medium">No agents found</p>
          <p className="text-sm mt-1">Create agent accounts in the Users section first.</p>
          <Link to="/admin/users" className="btn-primary inline-block mt-4 text-sm">
            Manage Users
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const load = maxOpen > 0 ? Math.round((agent.open / maxOpen) * 100) : 0
            const loadColor =
              load >= 80 ? 'text-red-600' :
              load >= 50 ? 'text-amber-500' :
              'text-green-600'
            const barColor =
              load >= 80 ? 'bg-red-500' :
              load >= 50 ? 'bg-amber-400' :
              'bg-green-500'

            return (
              <div
                key={agent.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >

                <div className="flex items-center gap-3 min-w-0 sm:w-64">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{agent.name}</p>
                    <p className="text-xs text-gray-400 truncate">{agent.email}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[agent.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[agent.role] || agent.role}
                  </span>
                </div>


                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-500">Open workload</span>
                    <span className={`text-xs font-semibold ${loadColor}`}>
                      {agent.open} open
                    </span>
                  </div>
                  <LoadBar value={agent.open} max={maxOpen} color={barColor} />
                </div>


                <div className="flex gap-5 shrink-0 text-center">
                  <div>
                    <p className="text-lg font-bold text-amber-500">{agent.open}</p>
                    <p className="text-xs text-gray-400">Open</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-500">{agent.high_priority}</p>
                    <p className="text-xs text-gray-400">High</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{agent.resolved}</p>
                    <p className="text-xs text-gray-400">Resolved</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-700">{agent.total}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}


      {agents.length > 0 && (
        <p className="text-xs text-gray-400 mt-5 text-center">
          Agents are sorted by open complaint count (highest first).
          Use <Link to="/admin/assignments" className="underline hover:text-gray-600">Category Assignments</Link> to rebalance.
        </p>
      )}
    </div>
  )
}
