import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError("Passwords don't match"); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    try {
      await register(form.name, form.email, form.password)
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-12"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%)' }}
      >
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'rgba(99,102,241,0.25)', filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '350px', height: '350px', borderRadius: '50%',
          background: 'rgba(59,130,246,0.2)', filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', top: '30%', left: '30%',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'rgba(139,92,246,0.15)', filter: 'blur(60px)',
        }} />

        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="text-7xl mb-6 drop-shadow-lg">✨</div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">Join Us Today</h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10">
            Create an account and start submitting complaints with AI-powered tracking and real-time updates.
          </p>
          <div className="flex flex-col gap-3 text-sm text-left">
            {[
              { step: '1', text: 'Register your account' },
              { step: '2', text: 'Submit your complaint' },
              { step: '3', text: 'AI classifies & prioritises' },
              { step: '4', text: 'Track resolution in real-time' },
            ].map((s) => (
              <div key={s.step}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <span className="w-7 h-7 rounded-full bg-blue-500/50 flex items-center justify-center text-xs font-bold shrink-0">
                  {s.step}
                </span>
                <span className="text-blue-100">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12
                      bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md">

          <div className="lg:hidden text-center mb-8">
            <div className="text-5xl mb-3">🎯</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create an Account</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl
                          dark:shadow-black/40 border border-gray-100
                          dark:border-gray-700 p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create account</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">Start tracking your complaints today</p>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800
                              text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Full Name
                </label>
                <input type="text" className="input-field" placeholder="John Doe"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <input type="email" className="input-field" placeholder="you@example.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <input type="password" className="input-field" placeholder="Min. 6 characters"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm Password
                </label>
                <input type="password" className="input-field" placeholder="Re-enter password"
                  value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all mt-1
                           bg-gradient-to-r from-blue-600 to-indigo-600
                           hover:from-blue-700 hover:to-indigo-700
                           disabled:opacity-50 disabled:cursor-not-allowed shadow-md
                           hover:shadow-blue-500/25 hover:shadow-lg">
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-7">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
