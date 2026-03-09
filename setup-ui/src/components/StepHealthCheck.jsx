import React, { useState, useEffect } from 'react'

export default function StepHealthCheck({ healthChecks, t }) {
  const [results, setResults] = useState([])
  const [checking, setChecking] = useState(false)

  const runChecks = () => {
    setChecking(true)
    setResults(
      healthChecks.map((hc) => ({
        ...hc,
        status: 'checking',
      }))
    )

    // Check each health endpoint sequentially
    const checkNext = async (index) => {
      if (index >= healthChecks.length) {
        setChecking(false)
        return
      }

      const hc = healthChecks[index]
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), (hc.timeout || 30) * 1000)
        const res = await fetch(hc.url, { signal: controller.signal })
        clearTimeout(timeout)

        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  status: res.status === (hc.expected_status || 200) ? 'ok' : 'failed',
                  httpStatus: res.status,
                }
              : r
          )
        )
      } catch {
        setResults((prev) =>
          prev.map((r, i) =>
            i === index ? { ...r, status: 'failed' } : r
          )
        )
      }

      checkNext(index + 1)
    }

    checkNext(0)
  }

  useEffect(() => {
    if (healthChecks.length > 0) {
      runChecks()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.container}>
      {results.map((hc, idx) => (
        <div key={idx} style={styles.item}>
          <div style={styles.status}>
            {hc.status === 'checking' && <div style={styles.spinner} />}
            {hc.status === 'ok' && <span style={styles.ok}>{'\u2713'}</span>}
            {hc.status === 'failed' && <span style={styles.failed}>{'\u2717'}</span>}
          </div>
          <div>
            <span style={styles.name}>{hc.name}</span>
            {hc.url && <span style={styles.url}>{hc.url}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: '#111118',
    borderRadius: '8px',
    border: '1px solid #1e1e2e',
  },
  status: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #2a2a3e',
    borderTopColor: '#F5900D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  ok: {
    color: '#22c55e',
    fontWeight: 700,
    fontSize: '16px',
  },
  failed: {
    color: '#ef4444',
    fontWeight: 700,
    fontSize: '16px',
  },
  name: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
    display: 'block',
  },
  url: {
    fontSize: '11px',
    color: '#64748b',
    display: 'block',
    marginTop: '2px',
  },
}
