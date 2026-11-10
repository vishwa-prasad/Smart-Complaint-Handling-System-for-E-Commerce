import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'

const WS_BASE    = 'ws://localhost:8001'
const IMG_BASE   = 'http://localhost:8001/uploads'

export default function ChatPanel({ complaintId, currentUser }) {
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [status,    setStatus]    = useState('connecting')
  const [online,    setOnline]    = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)

  const wsRef      = useRef(null)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const fileRef    = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!complaintId || !currentUser) return

    api.get(`/api/chat/${complaintId}/messages`)
      .then((r) => setMessages(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    const token = localStorage.getItem('token')
    const ws    = new WebSocket(`${WS_BASE}/ws/chat/${complaintId}?token=${token}`)
    wsRef.current = ws

    ws.onopen  = () => setStatus('open')
    ws.onclose = () => setStatus('closed')
    ws.onerror = () => setStatus('closed')

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message') {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
      if (data.type === 'system') {
        setOnline(data.online || 0)
        setMessages((prev) => [
          ...prev,
          { id: `sys-${Date.now()}`, type: 'system', message: data.message },
        ])
      }
    }

    return () => ws.close()
  }, [complaintId, currentUser])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || status !== 'open') return
    wsRef.current?.send(text)
    setInput('')
    inputRef.current?.focus()
  }, [input, status])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    const form = new FormData()
    form.append('image', file)
    form.append('message', input.trim() || '')

    try {
      await api.post(`/api/chat/${complaintId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setInput('')
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const isMe      = (msg) => msg.sender_id === currentUser?.id
  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  const roleBadge = (role) => {
    if (role === 'admin')    return <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold ml-1">ADMIN</span>
    if (role === 'employee') return <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold ml-1">STAFF</span>
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-[480px]">


      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">💬 Live Chat</span>
          {online > 1 && (
            <span className="text-xs bg-green-400 text-white px-2 py-0.5 rounded-full font-medium">
              {online} online
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          status === 'open'       ? 'bg-green-400 text-white' :
          status === 'connecting' ? 'bg-yellow-400 text-white' :
                                    'bg-red-400 text-white'
        }`}>
          {status === 'open' ? '● Connected' : status === 'connecting' ? '○ Connecting…' : '✕ Disconnected'}
        </span>
      </div>


      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <div className="text-center text-gray-400 text-sm py-4">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            <div className="text-3xl mb-2">💬</div>
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Start the conversation below.</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.message}</span>
              </div>
            )
          }

          const mine = isMe(msg)
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!mine && (
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-xs font-semibold text-gray-600">{msg.sender_name}</span>
                    {roleBadge(msg.sender_role)}
                  </div>
                )}

                {msg.image_path && (
                  <div className={`rounded-2xl overflow-hidden border ${mine ? 'border-blue-300' : 'border-gray-200'}`}>
                    <img
                      src={`${IMG_BASE}/${msg.image_path}`}
                      alt="attachment"
                      className="max-w-[220px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(`${IMG_BASE}/${msg.image_path}`, '_blank')}
                    />
                  </div>
                )}

                {msg.message && msg.message !== '📎 Image' && (
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.message}
                  </div>
                )}
                <span className="text-xs text-gray-400 px-1">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>


      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex gap-2 items-end">

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={status !== 'open' || uploading}
            title="Attach image"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 disabled:opacity-40 transition-colors text-base"
          >
            {uploading ? '⏳' : '📎'}
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 input-field resize-none text-sm py-2 max-h-24"
            placeholder={status === 'open' ? 'Type a message… (Enter to send)' : 'Reconnecting…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status !== 'open'}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || status !== 'open'}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 shrink-0"
          >
            Send ↑
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">Shift+Enter for new line · 📎 to attach image</p>
      </div>
    </div>
  )
}
