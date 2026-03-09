import React, { useEffect, useState } from 'react'

export default function StepSuccess({ template, t, i18n, onViewStatus }) {
  const [particles, setParticles] = useState([])
  const ts = t.success
  const tpl = template.template || {}
  const deploy = template.deploy || {}
  const healthChecks = deploy.health_checks || []
  const isPaid = tpl.paid

  // Simple confetti-like particle animation on mount
  useEffect(() => {
    const colors = ['#F5900D', '#E07D00', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']
    const p = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      size: 4 + Math.random() * 6,
    }))
    setParticles(p)
    const timer = setTimeout(() => setParticles([]), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={styles.container}>
      {/* Confetti */}
      {particles.length > 0 && (
        <div style={styles.confettiContainer}>
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: '-10px',
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animation: `confettiFall 2.5s ease-in ${p.delay}s forwards`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h2 style={styles.title}>{ts.title}</h2>
        <p style={styles.description}>{ts.description}</p>

        {healthChecks.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{ts.healthChecks}</h3>
            {healthChecks.map((hc) => {
              const displayUrl = hc.url ? hc.url.replace(/\/health$/, '') : ''
              return (
                <div key={hc.name} style={styles.healthRow}>
                  <span style={styles.healthName}>{hc.name}</span>
                  {displayUrl && (
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                      {displayUrl}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{ts.usefulLinks}</h3>
          <div style={styles.links}>
            {tpl.repository && (
              <a href={tpl.repository} target="_blank" rel="noopener noreferrer" style={styles.linkBtn}>
                {ts.documentation}
              </a>
            )}
            {tpl.support && (
              <a href={tpl.support} target="_blank" rel="noopener noreferrer" style={styles.linkBtn}>
                {ts.support}
              </a>
            )}
          </div>
        </div>

        {isPaid ? (
          <p style={styles.rateText}>{ts.rateUs} &#11088;</p>
        ) : (
          <p style={styles.premiumText}>{ts.premium} &rarr;</p>
        )}

        <button onClick={onViewStatus} style={styles.statusBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          {ts.viewStatus}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
    animation: 'fadeIn 0.4s ease',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '400px',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  card: {
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: '16px',
    padding: '48px',
    textAlign: 'center',
    maxWidth: '520px',
    width: '100%',
  },
  iconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#22c55e',
    marginBottom: '12px',
  },
  description: {
    fontSize: '15px',
    color: '#94a3b8',
    marginBottom: '28px',
  },
  section: {
    textAlign: 'left',
    marginBottom: '20px',
    padding: '14px',
    background: '#0a0a0f',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  },
  healthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  },
  healthName: {
    fontSize: '13px',
    color: '#e2e8f0',
  },
  link: {
    fontSize: '12px',
    color: '#F5900D',
    textDecoration: 'none',
  },
  links: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  linkBtn: {
    display: 'inline-block',
    background: '#1e1e2e',
    color: '#F5900D',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    textDecoration: 'none',
    fontWeight: 500,
  },
  rateText: {
    color: '#f59e0b',
    fontSize: '14px',
    marginBottom: '20px',
  },
  premiumText: {
    color: '#E07D00',
    fontSize: '14px',
    marginBottom: '20px',
  },
  statusBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #F5900D, #E07D00)',
    border: 'none',
    color: '#fff',
    borderRadius: '8px',
    padding: '12px 28px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}

// Confetti animation
if (typeof document !== 'undefined' && !document.getElementById('confetti-styles')) {
  const s = document.createElement('style')
  s.id = 'confetti-styles'
  s.textContent = `
    @keyframes confettiFall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
    }
  `
  document.head.appendChild(s)
}
