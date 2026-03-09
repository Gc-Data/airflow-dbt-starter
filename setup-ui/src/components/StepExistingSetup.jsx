import React, { useState, useCallback } from 'react'
import LogViewer from './LogViewer'

export default function StepExistingSetup({ status, t, onStartWizard, onRefreshStatus }) {
  const tx = t.existingSetup
  const [showConfirm, setShowConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [logsRunning, setLogsRunning] = useState(false)

  const { has_env, has_compose, containers, is_running } = status || {}
  const statusLoading = !status

  const hasContainers = containers && containers.length > 0
  const canStart = has_compose && !is_running

  const runSSEAction = useCallback((endpoint, method = 'POST') => {
    setLogs([])
    setShowLogs(true)
    setLogsRunning(true)

    fetch(endpoint, { method })
      .then((response) => {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setLogsRunning(false)
              setTimeout(() => onRefreshStatus(), 1500)
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type === 'log') {
                    setLogs((prev) => [...prev, data.line])
                  } else if (data.type === 'done') {
                    setLogsRunning(false)
                    setTimeout(() => onRefreshStatus(), 1500)
                  }
                } catch { /* skip */ }
              }
            }
            read()
          })
        }
        read()
      })
      .catch((err) => {
        setLogs((prev) => [...prev, `[ERROR] ${err.message}`])
        setLogsRunning(false)
      })
  }, [onRefreshStatus])

  const handleStart = () => {
    setActionLoading('start')
    runSSEAction('/api/services/start')
  }

  const handleStop = () => {
    setActionLoading('stop')
    fetch('/api/services/stop', { method: 'POST' })
      .then((r) => r.json())
      .then(() => {
        setActionLoading(null)
        onRefreshStatus()
      })
      .catch(() => setActionLoading(null))
  }

  const handleRestart = () => {
    setActionLoading('restart')
    fetch('/api/services/restart', { method: 'POST' })
      .then((r) => r.json())
      .then(() => {
        setActionLoading(null)
        onRefreshStatus()
      })
      .catch(() => setActionLoading(null))
  }

  const handleViewLogs = () => {
    if (showLogs && !logsRunning) {
      setShowLogs(false)
      return
    }
    runSSEAction('/api/services/logs', 'GET')
  }

  const handleReset = () => {
    setActionLoading('reset')
    fetch('/api/config/reset', { method: 'POST' })
      .then((r) => r.json())
      .then(() => {
        setActionLoading(null)
        setShowConfirm(false)
        onStartWizard()
      })
      .catch(() => setActionLoading(null))
  }

  const files = []
  if (has_env) files.push('.env')
  if (has_compose) files.push('docker-compose.yml')

  // Extract port links from running containers
  const portLinks = []
  if (containers) {
    for (const c of containers) {
      if (c.state?.toLowerCase() === 'running' && c.ports) {
        const matches = c.ports.match(/0\.0\.0\.0:(\d+)->(\d+)/g)
        if (matches) {
          for (const m of matches) {
            const port = m.match(/0\.0\.0\.0:(\d+)/)?.[1]
            if (port) {
              portLinks.push({ service: c.service || c.name, port, url: `http://localhost:${port}` })
            }
          }
        }
      }
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 style={styles.title}>{tx.title}</h2>
        <p style={styles.description}>{tx.description}</p>

        {/* Files found */}
        <div style={styles.filesBox}>
          <span style={styles.filesLabel}>{tx.filesFound}:</span>
          <div style={styles.filesList}>
            {files.map((f) => (
              <span key={f} style={styles.fileTag}>{f}</span>
            ))}
          </div>
        </div>

        {/* Container status badge */}
        {statusLoading ? (
          <div style={{
            ...styles.statusBadge,
            background: 'rgba(245,144,13,0.1)',
            borderColor: '#F5900D33',
            color: '#F5900D',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #F5900D', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            {tx.checkingContainers || 'Checking containers...'}
          </div>
        ) : (
          <div style={{
            ...styles.statusBadge,
            background: is_running ? 'rgba(34,197,94,0.1)' : hasContainers ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
            borderColor: is_running ? '#22c55e33' : hasContainers ? '#ef444433' : '#64748b33',
            color: is_running ? '#22c55e' : hasContainers ? '#ef4444' : '#64748b',
          }}>
            <span style={styles.statusDot(is_running ? '#22c55e' : hasContainers ? '#ef4444' : '#64748b')} />
            {is_running ? tx.containersRunning : hasContainers ? tx.containersStopped : tx.noContainers}
          </div>
        )}

        {/* Container table when running or stopped */}
        {hasContainers && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{tx.service}</th>
                  <th style={styles.th}>{tx.status}</th>
                  <th style={styles.th}>{tx.ports}</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{c.service || c.name}</td>
                    <td style={{
                      ...styles.td,
                      color: c.state?.toLowerCase() === 'running' ? '#22c55e' : '#ef4444',
                    }}>
                      {c.state?.toLowerCase() === 'running' ? tx.running : tx.exited}
                    </td>
                    <td style={styles.td}>{c.ports || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Port links */}
        {portLinks.length > 0 && (
          <div style={styles.linksBox}>
            {portLinks.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                {l.service} - {tx.accessAt} :{l.port}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={styles.actions}>
          {/* Start services (when stopped) */}
          {canStart && (
            <button
              onClick={handleStart}
              disabled={!!actionLoading}
              style={{ ...styles.btn, ...styles.btnPrimary, opacity: actionLoading ? 0.5 : 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {actionLoading === 'start' ? tx.starting : tx.startServices}
            </button>
          )}

          {/* Controls when running */}
          {is_running && (
            <>
              <button
                onClick={handleStop}
                disabled={!!actionLoading}
                style={{ ...styles.btn, ...styles.btnDanger, opacity: actionLoading ? 0.5 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
                {actionLoading === 'stop' ? tx.stopping : tx.stop}
              </button>
              <button
                onClick={handleRestart}
                disabled={!!actionLoading}
                style={{ ...styles.btn, ...styles.btnSecondary, opacity: actionLoading ? 0.5 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
                {actionLoading === 'restart' ? tx.restarting : tx.restart}
              </button>
            </>
          )}

          {/* View logs */}
          {hasContainers && (
            <button
              onClick={handleViewLogs}
              disabled={logsRunning}
              style={{ ...styles.btn, ...styles.btnGhost }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {showLogs && !logsRunning ? tx.hideLogs : tx.viewLogs}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={onRefreshStatus}
            disabled={!!actionLoading}
            style={{ ...styles.btn, ...styles.btnGhost }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            {tx.refreshStatus}
          </button>
        </div>

        {/* Logs viewer */}
        {showLogs && (
          <div style={{ marginTop: '16px' }}>
            <LogViewer logs={logs} running={logsRunning} />
          </div>
        )}

        {/* Divider */}
        <div style={styles.divider} />

        {/* New configuration */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ ...styles.btn, ...styles.btnOutline, width: '100%' }}
          >
            {tx.newConfig}
          </button>
        ) : (
          <div style={styles.confirmBox}>
            <p style={styles.confirmText}>{tx.newConfigWarn}</p>
            <div style={styles.confirmActions}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ ...styles.btn, ...styles.btnGhost }}
              >
                {tx.cancel}
              </button>
              <button
                onClick={handleReset}
                disabled={actionLoading === 'reset'}
                style={{ ...styles.btn, ...styles.btnDanger }}
              >
                {tx.confirm}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '400px',
    animation: 'fadeIn 0.3s ease',
  },
  card: {
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '640px',
    width: '100%',
  },
  iconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(245,158,11,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: '24px',
  },
  filesBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  filesLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 600,
  },
  filesList: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  fileTag: {
    background: '#1e1e2e',
    color: '#94a3b8',
    padding: '2px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '20px',
  },
  statusDot: (color) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
  }),
  tableWrap: {
    overflowX: 'auto',
    marginBottom: '16px',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#64748b',
    fontWeight: 600,
    borderBottom: '1px solid #1e1e2e',
    background: '#0d0d17',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '8px 12px',
    color: '#94a3b8',
    borderBottom: '1px solid #1e1e2e',
    fontFamily: '"SF Mono", "Fira Code", monospace',
    fontSize: '12px',
  },
  linksBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '20px',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#F5900D',
    fontSize: '13px',
    textDecoration: 'none',
    padding: '6px 12px',
    background: 'rgba(245,144,13,0.08)',
    borderRadius: '6px',
    transition: 'background 0.2s',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#fff',
    transition: 'opacity 0.2s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #F5900D, #E07D00)',
  },
  btnSecondary: {
    background: '#B36A00',
  },
  btnDanger: {
    background: '#7f1d1d',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #2a2a3e',
    color: '#94a3b8',
  },
  btnOutline: {
    background: 'transparent',
    border: '1px solid #f59e0b33',
    color: '#f59e0b',
    justifyContent: 'center',
  },
  divider: {
    height: '1px',
    background: '#1e1e2e',
    margin: '24px 0',
  },
  confirmBox: {
    background: '#1a0a0a',
    border: '1px solid #ef444433',
    borderRadius: '10px',
    padding: '16px',
  },
  confirmText: {
    color: '#f87171',
    fontSize: '13px',
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
}
