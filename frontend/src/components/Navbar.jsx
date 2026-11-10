import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin      = user?.role === 'admin' || user?.role === 'employee'
  const isSuperAdmin = user?.role === 'admin'

  return (
    <nav className="bg-blue-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="text-2xl">🎯</span>
            <span>SmartComplaints</span>
          </Link>


          {user ? (
            <div className="flex items-center gap-6">
              {!isAdmin && (
                <>
                  <Link to="/dashboard" className="hover:text-blue-200 text-sm font-medium transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/submit" className="hover:text-blue-200 text-sm font-medium transition-colors">
                    Submit Complaint
                  </Link>
                  <Link to="/my-complaints" className="hover:text-blue-200 text-sm font-medium transition-colors">
                    My Complaints
                  </Link>
                </>
              )}
              {isAdmin && (
                <>
                  {isSuperAdmin && (
                    <Link to="/admin" className="hover:text-blue-200 text-sm font-medium transition-colors">
                      Dashboard
                    </Link>
                  )}
                  <Link to="/admin/complaints" className="hover:text-blue-200 text-sm font-medium transition-colors">
                    {user?.role === 'employee' ? 'My Queue' : 'All Complaints'}
                  </Link>
                  {isSuperAdmin && (
                    <>
                      <Link to="/admin/analytics" className="hover:text-blue-200 text-sm font-medium transition-colors">
                        Analytics
                      </Link>
                      <Link to="/admin/users" className="hover:text-blue-200 text-sm font-medium transition-colors">
                        Users
                      </Link>
                      <Link to="/admin/assignments" className="hover:text-blue-200 text-sm font-medium transition-colors">
                        Assignments
                      </Link>
                      <Link to="/admin/workload" className="hover:text-blue-200 text-sm font-medium transition-colors">
                        Workload
                      </Link>
                      <Link to="/admin/performance" className="hover:text-blue-200 text-sm font-medium transition-colors">
                        Performance
                      </Link>
                    </>
                  )}
                </>
              )}
              <div className="flex items-center gap-3 border-l border-blue-500 pl-4">
                <span className="text-sm text-blue-200">
                  {user.name}
                  {isSuperAdmin && (
                    <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-bold">MAIN ADMIN</span>
                  )}
                  {user?.role === 'employee' && (
                    <span className="ml-1 bg-teal-400 text-teal-900 text-xs px-1.5 py-0.5 rounded font-bold">AGENT</span>
                  )}
                </span>

                <button
                  onClick={toggle}
                  title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 transition-colors text-base"
                >
                  {dark ? '☀️' : '🌙'}
                </button>
                <button onClick={handleLogout} className="text-sm bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded-lg transition-colors">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={toggle}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 transition-colors text-base"
              >
                {dark ? '☀️' : '🌙'}
              </button>
              <Link to="/login" className="hover:text-blue-200 text-sm font-medium">Login</Link>
              <Link to="/register" className="bg-white text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
