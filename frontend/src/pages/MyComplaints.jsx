import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import ComplaintCard from '../components/ComplaintCard'

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Escalated', 'Resolved']

const CATEGORIES = [
  { key: 'all',                   label: 'All Issues',            icon: '📋', color: 'blue' },
  { key: 'product-issue',         label: 'Product Issue',         icon: '📦', color: 'orange' },
  { key: 'delivery-issue',        label: 'Delivery Issue',        icon: '🚚', color: 'purple' },
  { key: 'refund-issue',          label: 'Refund Issue',          icon: '💰', color: 'green' },
  { key: 'account-login-issue',   label: 'Account / Login Issue', icon: '🔐', color: 'red' },
  { key: 'customer-service-issue',label: 'Customer Service Issue',icon: '🎧', color: 'indigo' },
]


const KEY_TO_CATEGORY = {
  'product-issue':          'Product Issue',
  'delivery-issue':         'Delivery Issue',
  'refund-issue':           'Refund Issue',
  'account-login-issue':    'Account/Login Issue',
  'customer-service-issue': 'Customer Service Issue',
}

const COLOR_CLASSES = {
  blue:   { active: 'bg-blue-600 text-white',   dot: 'bg-blue-500',   count: 'bg-blue-100 text-blue-700' },
  orange: { active: 'bg-orange-500 text-white',  dot: 'bg-orange-400', count: 'bg-orange-100 text-orange-700' },
  purple: { active: 'bg-purple-600 text-white',  dot: 'bg-purple-500', count: 'bg-purple-100 text-purple-700' },
  green:  { active: 'bg-green-600 text-white',   dot: 'bg-green-500',  count: 'bg-green-100 text-green-700' },
  red:    { active: 'bg-red-600 text-white',     dot: 'bg-red-500',    count: 'bg-red-100 text-red-700' },
  indigo: { active: 'bg-indigo-600 text-white',  dot: 'bg-indigo-500', count: 'bg-indigo-100 text-indigo-700' },
  yellow: { active: 'bg-yellow-500 text-white',  dot: 'bg-yellow-400', count: 'bg-yellow-100 text-yellow-700' },
}

export default function MyComplaints() {
  const { category: categoryParam = 'all' } = useParams()
  const navigate = useNavigate()

  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allComplaints, setAllComplaints] = useState([])   

  const fetchComplaints = () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (search)     params.append('search', search)
    if (statusFilter !== 'All') params.append('status', statusFilter)
    if (dateFrom)   params.append('date_from', dateFrom)
    if (dateTo)     params.append('date_to', dateTo)

    api.get(`/api/complaints/my?${params.toString()}`)
      .then((r) => setComplaints(r.data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }


  useEffect(() => {
    api.get('/api/complaints/my?limit=200')
      .then((r) => setAllComplaints(r.data.items || []))
      .catch(console.error)
  }, [])


  useEffect(() => {
    fetchComplaints()

  }, [statusFilter, dateFrom, dateTo])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchComplaints()
  }

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setStatusFilter('All')
  }


  const countFor = (key) => {
    if (key === 'all') return allComplaints.length
    const cat = KEY_TO_CATEGORY[key]
    return allComplaints.filter((c) => c.category === cat).length
  }


  const activeCategory = KEY_TO_CATEGORY[categoryParam]
  const filtered = complaints.filter((c) => {
    return categoryParam === 'all' || c.category === activeCategory
  })

  const hasActiveFilters = search || dateFrom || dateTo || statusFilter !== 'All'

  const currentCat = CATEGORIES.find((c) => c.key === categoryParam) || CATEGORIES[0]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">


      <aside className="w-60 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Browse by Issue</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = cat.key === categoryParam
              const colors   = COLOR_CLASSES[cat.color]
              const cnt      = countFor(cat.key)
              return (
                <Link
                  key={cat.key}
                  to={cat.key === 'all' ? '/my-complaints' : `/my-complaints/${cat.key}`}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? colors.active
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </span>
                  {cnt > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : colors.count
                    }`}>
                      {cnt}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <Link to="/submit" className="btn-primary w-full text-center block text-sm">
              + New Complaint
            </Link>
          </div>
        </div>
      </aside>


      <div className="flex-1 min-w-0">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>{currentCat.icon}</span>
              <span>{currentCat.label}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} complaint{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>


        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 space-y-3">

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search complaints by keyword..."
              className="input-field flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4">Search</button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Clear
              </button>
            )}
          </form>


          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>From</span>
              <input
                type="date"
                className="input-field py-1.5 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span>To</span>
              <input
                type="date"
                className="input-field py-1.5 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>


        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-2 animate-spin inline-block">⚙️</div>
            <p>Loading complaints...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">{currentCat.icon}</div>
            <p className="font-medium">No {currentCat.label.toLowerCase()} found</p>
            {complaints.length === 0 && (
              <Link to="/submit" className="btn-primary inline-block mt-4">Submit Your First Complaint</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
