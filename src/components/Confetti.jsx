import React, { useEffect, useMemo } from 'react'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#facc15']

export default function Confetti({ onDone }) {
  const pieces = useMemo(() => {
    return Array.from({ length: 90 }).map((_, i) => ({
      left: Math.random() * 100,
      bg: COLORS[i % COLORS.length],
      delay: Math.random() * 0.5,
      duration: 2.4 + Math.random() * 1.6,
      size: 7 + Math.random() * 7,
      rot: Math.random() * 360,
    }))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), 4200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.bg,
            width: p.size,
            height: p.size * 1.6,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotateZ(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  )
}
