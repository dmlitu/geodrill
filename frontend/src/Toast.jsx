import { useState, useCallback, useEffect, createContext, useContext } from "react"

const ToastContext = createContext()

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#16A34A" />
      <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#DC2626" />
      <path d="M6.5 6.5L11.5 11.5M11.5 6.5L6.5 11.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#0EA5E9" />
      <path d="M9 8V12.5M9 6V6.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

const STYLES = {
  success: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" },
  error:   { background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" },
  info:    { background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0369A1" },
}

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast, onRemove])

  const style = STYLES[toast.type] || STYLES.info

  return (
    <div
      style={{
        ...style,
        display: "flex", alignItems: "center", gap: "10px",
        padding: "12px 16px", borderRadius: "10px",
        fontSize: "13px", fontWeight: "500",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        animation: exiting ? "toastOut 0.3s ease forwards" : "toastIn 0.35s ease forwards",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        maxWidth: "360px",
        pointerEvents: "auto",
      }}
    >
      {ICONS[toast.type] || ICONS.info}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 300) }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "inherit", opacity: 0.5, fontSize: "16px",
          padding: "0 2px", lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = "info", duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, "success", dur),
    error: (msg, dur) => addToast(msg, "error", dur || 5000),
    info: (msg, dur) => addToast(msg, "info", dur),
  }, [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: "fixed", top: "16px", right: "16px",
        zIndex: 9999,
        display: "flex", flexDirection: "column", gap: "8px",
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
