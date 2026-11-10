import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const CHANNELS = ['Web Form', 'Email', 'Phone', 'Chat', 'Social Media']

const EXAMPLES = [
  "My account was hacked and I see unauthorized purchases!",
  "The shipment tracking has not updated in several days.",
  "I received a wrong item that doesn't match my order.",
  "The product I received is completely broken and damaged.",
  "I need a refund for an order I cancelled last week.",
  "The support agent was very rude and unhelpful.",
]

export default function SubmitComplaint() {
  const navigate  = useNavigate()
  const fileRef   = useRef(null)
  const cameraRef = useRef(null)

  const [text,    setText]    = useState('')
  const [channel, setChannel] = useState('Web Form')
  const [image,   setImage]   = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return }
    setImage(file); setError('')
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null); setPreview(null)
    if (fileRef.current)   fileRef.current.value   = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || text.trim().length < 10) { setError('Please describe your complaint in at least 10 characters.'); return }
    setError(''); setLoading(true)
    try {
      const formData = new FormData()
      formData.append('complaint_text', text)
      formData.append('channel', channel)
      if (image) formData.append('image', image)
      const res = await api.post('/api/complaints/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit complaint.')
    } finally { setLoading(false) }
  }

  /* ── Success screen ─────────────────────────────────────────── */
  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-2xl border-2 border-green-400 dark:border-emerald-500/40 bg-green-50 dark:bg-[#051a0f] p-8 text-center dark:shadow-[0_0_40px_rgba(16,185,129,0.08)]">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-emerald-500/20 dark:border dark:border-emerald-500/40 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Complaint Submitted!</h2>
          <p className="text-gray-500 text-sm mb-7">Our AI has classified your complaint</p>

          {/* Details */}
          <div className="bg-white dark:bg-[#0d1f0d] dark:border dark:border-gray-700/60 rounded-xl p-6 text-left space-y-3 mb-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Complaint ID</span>
              <button onClick={() => navigate(`/complaint/${result.complaint_id}`)}
                className="text-sm font-mono font-semibold text-blue-600 dark:text-cyan-400 hover:underline">
                {result.complaint_id} ↗
              </button>
            </div>
            <Row label="Category" value={result.category} />
            <Row label="Status" value={result.status} />
          </div>

          {result.image_path && (
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-2">Attached photo</p>
              <img src={`http://localhost:8001/uploads/${result.image_path}`} alt="Complaint attachment"
                className="rounded-xl max-h-48 mx-auto object-cover shadow dark:border dark:border-gray-700/40" />
            </div>
          )}

          {result.resolution_note && (
            <div className="bg-white dark:bg-[#111827] dark:border dark:border-gray-700/50 rounded-xl p-4 text-left mb-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-1">Resolution Plan</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{result.resolution_note}</p>
            </div>
          )}

          {result.assigned_to && (
            <div className="flex items-center justify-center gap-2 bg-teal-50 dark:bg-cyan-500/5 border border-teal-100 dark:border-cyan-500/20 rounded-xl px-4 py-3 mb-6">
              <span className="text-teal-600 dark:text-cyan-400 text-lg">👤</span>
              <p className="text-sm text-teal-800 dark:text-cyan-300">
                Assigned to <span className="font-semibold dark:text-white">{result.assigned_to.name}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate(`/complaint/${result.complaint_id}`)}
              className="btn-primary flex items-center justify-center gap-2 px-6 dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-gray-900">
              📍 Track This Complaint
            </button>
            <button onClick={() => navigate('/my-complaints')} className="btn-secondary dark:bg-[#1a2535] dark:text-gray-300 dark:border-gray-600 dark:hover:bg-[#232f42]">
              All My Complaints
            </button>
            <button onClick={() => { setResult(null); setText(''); removeImage() }} className="btn-secondary dark:bg-[#1a2535] dark:text-gray-300 dark:border-gray-600 dark:hover:bg-[#232f42]">
              Submit Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Form screen ────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Submit a Complaint</h1>
      <p className="text-gray-500 text-sm mb-6">Our AI will automatically categorize your complaint and route it to the right team</p>

      <div className="card dark:bg-[#111827] dark:border-gray-700/60 mb-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Complaint text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe your complaint <span className="text-red-500 dark:text-rose-400">*</span>
            </label>
            <textarea rows={6}
              placeholder="Please describe your issue in detail…"
              value={text} onChange={(e) => setText(e.target.value)} required
              className="input-field resize-none dark:bg-[#0d1117] dark:text-gray-200 dark:placeholder-gray-600 dark:border-gray-700 dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/20" />
            <div className="flex justify-between mt-1">
              {error && <p className="text-red-500 dark:text-rose-400 text-xs">{error}</p>}
              <p className="text-xs text-gray-400 ml-auto">{text.length} characters</p>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attach a Photo <span className="text-gray-400 font-normal">(optional — JPG/PNG, max 5MB)</span>
            </label>
            {preview ? (
              <div className="relative inline-block mb-3">
                <img src={preview} alt="Preview"
                  className="rounded-xl max-h-48 object-cover border border-gray-200 dark:border-gray-700 shadow-sm" />
                <button type="button" onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">✕</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400 dark:hover:bg-cyan-500/5 transition-all">
                  🖼️ Choose from Gallery
                </button>
                <button type="button" onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/5 transition-all">
                  📷 Take Photo
                </button>
              </div>
            )}
            <input ref={fileRef}   type="file" accept="image/*"                       className="hidden" onChange={handleImageChange} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred Contact Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input-field dark:bg-[#0d1117] dark:text-gray-200 dark:border-gray-700">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading}
            className="btn-primary w-full py-3 dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-gray-900 dark:font-bold">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Analyzing & Submitting…
              </span>
            ) : '🚀 Submit Complaint'}
          </button>
        </form>
      </div>

      {/* Examples */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Try an example:</p>
        <div className="space-y-2">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setText(ex)}
              className="w-full text-left text-sm bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700/60 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-[#1a2535] hover:border-blue-300 dark:hover:border-gray-600 transition-colors text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}
