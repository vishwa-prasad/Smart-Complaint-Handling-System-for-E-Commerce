import api from '../api/axios'

const POLL_INTERVAL_MS = 30_000   
const STORAGE_KEY      = 'sc_complaint_statuses'

let _pollTimer  = null
let _userId     = null


export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}


function fireNotification(title, body, complaintId) {
  if (Notification.permission !== 'granted') return

  const n = new Notification(title, {
    body,
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    tag:   complaintId,           
    requireInteraction: false,
  })


  n.onclick = () => {
    window.focus()
    window.location.href = `/complaint/${complaintId}`
    n.close()
  }
}


function loadKnownStatuses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveKnownStatuses(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}


async function poll() {

  const token = localStorage.getItem('token')
  if (!token) {
    stopNotificationPolling()
    return
  }

  try {
    const res = await api.get('/api/complaints/my?limit=50')
    const complaints = res.data?.items || []

    const known   = loadKnownStatuses()
    const updated = { ...known }
    let changed   = false

    complaints.forEach((c) => {
      const prev = known[c.complaint_id]

      if (prev === undefined) {
        updated[c.complaint_id] = c.status
        changed = true
        return
      }

      if (prev !== c.status) {
        const statusEmoji = {
          'In Progress': '🔍',
          'Escalated':   '🚨',
          'Resolved':    '✅',
          'Open':        '📝',
        }[c.status] || '📋'

        fireNotification(
          `${statusEmoji} Complaint ${c.complaint_id} Updated`,
          `Status changed: ${prev} → ${c.status}`,
          c.complaint_id,
        )

        updated[c.complaint_id] = c.status
        changed = true
      }
    })

    if (changed) saveKnownStatuses(updated)
  } catch (err) {

    if (err?.response?.status === 401) {
      stopNotificationPolling()
    }

  }
}


export function startNotificationPolling(userId) {
  if (_pollTimer) return               
  _userId = userId


  poll()
  _pollTimer = setInterval(poll, POLL_INTERVAL_MS)
}

export function stopNotificationPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
  _userId = null
}
