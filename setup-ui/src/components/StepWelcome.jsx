import React from 'react'

export default function StepWelcome({ template, t, i18n, onNext }) {
  const name = i18n(template.template?.name)
  const desc = i18n(template.template?.description)
  const version = template.template?.version
  const author = template.template?.author
  const tags = template.template?.tags || []

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F5900D" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <h1 style={styles.title}>{name}</h1>
        <p style={styles.description}>{desc}</p>

        <div style={styles.meta}>
          {version && (
            <span style={styles.badge}>
              {t.welcome.version} {version}
            </span>
          )}
          {author && (
            <span style={styles.author}>
              {t.welcome.by} {author}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div style={styles.tags}>
            {tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <button onClick={onNext} style={styles.button}>
          {t.welcome.getStarted}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '8px' }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
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
    background: 'rgba(245,144,13,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    marginBottom: '12px',
    color: '#f1f5f9',
  },
  description: {
    fontSize: '15px',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  meta: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  badge: {
    background: '#1e1e2e',
    color: '#F5900D',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },
  author: {
    color: '#64748b',
    fontSize: '13px',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  tag: {
    background: '#1a1a2e',
    color: '#64748b',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #F5900D, #E07D00)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 32px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
}
