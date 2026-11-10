import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

export function priorityBadge(priority) {
  const map = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  }
  return map[priority] || 'badge-medium'
}

export function statusBadge(status) {
  const map = {
    Open: 'status-open',
    'In Progress': 'status-progress',
    Escalated: 'status-escalated',
    Resolved: 'status-resolved',
  }
  return map[status] || 'status-open'
}

function StarRating({ complaintId, currentRating, onRated }) {
  const [hovered, setHovered] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [rated, setRated] = useState(currentRating || null)

  const submit = async (star) => {
    if (rated) return
    setSubmitting(true)
    try {
      await api.post(`/api/complaints/${complaintId}/rate`, { rating: star })
      setRated(star)
      if (onRated) onRated(star)
    } catch (err) {
      alert(err.response?.data?.detail || 'Rating failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (rated) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <span className="text-xs text-gray-500 mr-1">Your rating:</span>
        {[1,2,3,4,5].map((s) => (
          <span key={s} className={`text-base ${s <= rated ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      <span className="text-xs text-gray-500 mr-1">Rate resolution:</span>
      {[1,2,3,4,5].map((s) => (
        <button
          key={s}
          disabled={submitting}
          onClick={() => submit(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className={`text-xl leading-none transition-colors ${
            s <= (hovered || 0) ? 'text-yellow-400' : 'text-gray-300'
          } hover:scale-110 disabled:opacity-50`}
        >
          ★
        </button>
      ))}
      {submitting && <span className="text-xs text-gray-400 ml-1">Saving...</span>}
    </div>
  )
}

export default function ComplaintCard({ complaint, onRated }) {
  const navigate = useNavigate()
  const date = complaint.created_at
    ? new Date(complaint.created_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—'

  return (
    <div
      className={`card hover:shadow-md transition-shadow cursor-pointer ${complaint.sla_breached ? 'border-l-4 border-red-400' : ''}`}
      onClick={() => navigate(`/complaint/${complaint.complaint_id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-gray-500">{complaint.complaint_id}</span>
            <span className={statusBadge(complaint.status)}>{complaint.status}</span>
            {complaint.sla_breached && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">⚠️ Being handled urgently</span>
            )}
          </div>
          <p className="text-sm text-gray-800 line-clamp-2 mb-2">{complaint.complaint_text}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {complaint.category && (
              <span className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {complaint.category}
              </span>
            )}
            {complaint.assigned_to && (
              <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full font-medium border border-teal-100">
                <span>👤</span>
                <span>{complaint.assigned_to.name}</span>
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-400 whitespace-nowrap">
          {date}
        </div>
      </div>
      {complaint.resolution_note && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Resolution: </span>
            {complaint.resolution_note}
          </p>
        </div>
      )}

      {complaint.status === 'Resolved' && (
        <div className="mt-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
          <StarRating
            complaintId={complaint.complaint_id}
            currentRating={complaint.satisfaction_rating}
            onRated={onRated}
          />
        </div>
      )}
    </div>
  )
}
