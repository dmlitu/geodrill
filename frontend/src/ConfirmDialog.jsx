import { useEffect, useRef } from "react"

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = "Sil", danger = true }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(2px)",
        animation: "fadeUp 0.15s ease",
      }}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.key === "Escape" && onCancel()}
        style={{
          background: "white", borderRadius: "14px",
          padding: "28px 32px", width: "100%", maxWidth: "380px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          animation: "fadeUp 0.2s ease",
        }}
      >
        <h3 style={{
          fontSize: "16px", fontWeight: "700",
          color: "#0C4A6E", marginBottom: "8px",
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: "14px", color: "#64748B",
          lineHeight: "1.5", marginBottom: "24px",
        }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 20px", border: "1px solid #E2E8F0",
              borderRadius: "8px", background: "white",
              color: "#64748B", fontSize: "13px", fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Vazgec
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 20px", border: "none",
              borderRadius: "8px",
              background: danger ? "#DC2626" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
              color: "white", fontSize: "13px", fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
