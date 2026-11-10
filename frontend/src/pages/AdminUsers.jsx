import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const ROLES = ['user', 'employee', 'admin']

const SECTION_CONFIG = {
  staff: {
    label: 'Support Staff',
    icon: '🧑‍💼',
    roles: ['admin', 'employee'],
    badge: { admin: 'bg-purple-100 text-purple-700', employee: 'bg-blue-100 text-blue-700' },
    emptyMsg: 'No staff members found.',
  },
  customer: {
    label: 'Customers',
    icon: '👤',
    roles: ['user'],
    badge: { user: 'bg-gray-100 text-gray-600' },
    emptyMsg: 'No customers registered yet.',
  },
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('staff')

  const fetchUsers = () => {
    api.get('/api/admin/users')
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const toggleUser = async (userId) => {
    try {
      await api.patch(`/api/admin/users/${userId}/toggle`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    }
  }

  const changeRole = async (userId, role) => {
    try {
      await api.patch(`/api/admin/users/${userId}/role?role=${role}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    }
  }

  const staff     = users.filter((u) => ['admin', 'employee'].includes(u.role))
  const customers = users.filter((u) => u.role === 'user')
  const current   = tab === 'staff' ? staff : customers
  const cfg       = SECTION_CONFIG[tab]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          {staff.length} staff · {customers.length} customers · {users.length} total
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users"   value={users.length}                        color="text-gray-700"   bg="bg-gray-50"   border="border-gray-200" />
        <StatCard label="Staff"         value={staff.length}                        color="text-purple-700" bg="bg-purple-50" border="border-purple-200" />
        <StatCard label="Customers"     value={customers.length}                    color="text-blue-700"   bg="bg-blue-50"   border="border-blue-200" />
        <StatCard label="Active"        value={users.filter(u => u.is_active).length} color="text-green-700"  bg="bg-green-50"  border="border-green-200" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'staff',    label: `🧑‍💼 Support Staff (${staff.length})` },
          { key: 'customer', label: `👤 Customers (${customers.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              tab === key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading users...</div>
        ) : current.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{cfg.emptyMsg}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {current.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>

                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{u.id}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        u.role === 'admin'    ? 'bg-purple-100 text-purple-700' :
                        u.role === 'employee' ? 'bg-blue-100 text-blue-700'    :
                                               'bg-gray-100 text-gray-600'
                      }`}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>

                  <td className="px-4 py-3">
                    {u.id === me?.id ? (
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold">
                        {u.role} (you)
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                    }`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>

                  <td className="px-4 py-3">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleUser(u.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                          u.is_active
                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note for staff tab */}
      {tab === 'staff' && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Employees and Admins appear in the Assignment page as available agents.
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg, border }) {
  return (
    <div className={`rounded-xl border ${bg} ${border} px-4 py-3`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
