import React, { useState, useCallback, useRef, useEffect } from 'react'
import LogViewer from './LogViewer'

/**
 * Deploy phases are read from wizard.json → deploy.phases[]
 * Each phase: { id, label: {pt-BR, en}, pattern: "regex string" }
 * The first phase (no pattern) activates on deploy start.
 * Subsequent phases activate when their pattern matches a log line.
 */

function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (running) {
      const t0 = Date.now()
      ref.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    } else {
      clearInterval(ref.current)
    }
    return () => clearInterval(ref.current)
  }, [running])

  return elapsed
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function DeployStepper({ phases, activePhaseIdx, result, i18n }) {
  return (
    <div style={stepperStyles.container}>
      {phases.map((phase, idx) => {
        let status = 'pending'
        if (result === 'failed' && idx === activePhaseIdx) {
          status = 'error'
        } else if (idx < activePhaseIdx || (result === 'success' && idx <= activePhaseIdx)) {
          status = 'done'
        } else if (idx === activePhaseIdx) {
          status = 'active'
        }

        return (
          <div key={phase.id} style={stepperStyles.step}>
            <div style={stepperStyles.iconRow}>
              <PhaseIcon status={status} />
              {idx < phases.length - 1 && (
                <div
                  style={{
                    ...stepperStyles.connector,
                    background: status === 'done' ? '#22c55e' : '#2a2a3e',
                  }}
                />
              )}
            </div>
            <span
              style={{
                ...stepperStyles.label,
                color:
                  status === 'active' ? '#e2e8f0' :
                  status === 'done' ? '#22c55e' :
                  status === 'error' ? '#ef4444' :
                  '#4a5568',
                fontWeight: status === 'active' ? 600 : 400,
              }}
            >
              {i18n(phase.label)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PhaseIcon({ status }) {
  if (status === 'done') {
    return <span style={{ ...stepperStyles.icon, background: '#22c55e22', color: '#22c55e' }}>&#x2705;</span>
  }
  if (status === 'error') {
    return <span style={{ ...stepperStyles.icon, background: '#ef444422', color: '#ef4444' }}>&#x274C;</span>
  }
  if (status === 'active') {
    return (
      <span style={{ ...stepperStyles.icon, background: '#F5900D22', color: '#F5900D' }}>
        <span style={stepperStyles.spinner} />
      </span>
    )
  }
  return <span style={{ ...stepperStyles.icon, background: '#1e1e2e', color: '#4a5568' }}>&#x23F3;</span>
}

const stepperStyles = {
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    padding: '16px 8px',
    background: '#0d0d17',
    borderRadius: '10px',
    border: '1px solid #1e1e2e',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: '8px',
  },
  connector: {
    position: 'absolute',
    top: '50%',
    left: '55%',
    width: '90%',
    height: '2px',
    transform: 'translateY(-50%)',
    transition: 'background 0.3s ease',
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '14px',
    zIndex: 1,
    position: 'relative',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid #F5900D33',
    borderTopColor: '#F5900D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  label: {
    fontSize: '11px',
    textAlign: 'center',
    lineHeight: '1.3',
    maxWidth: '100px',
    transition: 'color 0.3s ease',
  },
}

export default function StepDeploy({ template, t, i18n, onNext, onBack }) {
  const [logs, setLogs] = useState([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [activePhaseIdx, setActivePhaseIdx] = useState(-1)
  const [logsExpanded, setLogsExpanded] = useState(true)
  const elapsed = useElapsed(running)

  // Read phases from wizard.json → deploy.phases (if defined)
  const phases = (template.deploy && template.deploy.phases) || []

  // Compile regex patterns once
  const compiledPatterns = useRef([])
  useEffect(() => {
    compiledPatterns.current = phases.map((p) =>
      p.pattern ? new RegExp(p.pattern, 'i') : null
    )
  }, [phases])

  const processLogLine = useCallback((line) => {
    for (let i = compiledPatterns.current.length - 1; i >= 0; i--) {
      if (compiledPatterns.current[i] && compiledPatterns.current[i].test(line)) {
        setActivePhaseIdx((prev) => Math.max(prev, i))
        break
      }
    }
  }, [])

  const runSSE = useCallback((endpoint, action) => {
    setLogs([])
    setRunning(true)
    setResult(null)
    setActiveAction(action)
    // First phase (no pattern) activates immediately
    if (phases.length > 0) {
      setActivePhaseIdx(0)
    }

    fetch(endpoint, { method: 'POST' })
      .then((response) => {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setRunning(false)
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
                    processLogLine(data.line)
                  } else if (data.type === 'health') {
                    const status = data.status === 'ok' ? '\u2713' : '\u2717'
                    const healthLine = `[HEALTH] ${status} ${data.service}${data.url ? ' \u2014 ' + data.url : ''}`
                    setLogs((prev) => [...prev, healthLine])
                    processLogLine(healthLine)
                  } else if (data.type === 'done') {
                    setResult(data.success ? 'success' : 'failed')
                    setRunning(false)
                  }
                } catch {
                  // skip malformed JSON
                }
              }
            }

            read()
          })
        }

        read()
      })
      .catch((err) => {
        setLogs((prev) => [...prev, `[ERROR] ${err.message}`])
        setRunning(false)
        setResult('failed')
      })
  }, [phases.length, processLogLine])

  const handleCleanup = () => {
    setActiveAction('cleanup')
    setActivePhaseIdx(-1)
    setRunning(true)
    fetch('/api/cleanup', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setRunning(false)
        if (data.status === 'ok') {
          setLogs((prev) => [...prev, `[CLEANUP] ${data.message}`])
          setResult(null)
        } else {
          setLogs((prev) => [...prev, `[ERROR] ${data.message}`])
        }
        setActiveAction(null)
      })
      .catch((err) => {
        setRunning(false)
        setLogs((prev) => [...prev, `[ERROR] ${err.message}`])
        setActiveAction(null)
      })
  }

  const td = t.deploy
  const showStepper = phases.length > 0 && (running || result) && activePhaseIdx >= 0

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{td.title}</h2>
      <p style={styles.description}>{td.description}</p>

      <div style={styles.buttonRow}>
        <button
          onClick={() => runSSE('/api/test', 'test')}
          disabled={running}
          style={{
            ...styles.actionBtn,
            ...styles.testBtn,
            opacity: running ? 0.5 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {activeAction === 'test' && running ? td.running : td.testLocally}
        </button>

        <button
          onClick={handleCleanup}
          disabled={running}
          style={{
            ...styles.actionBtn,
            ...styles.cleanupBtn,
            opacity: running ? 0.5 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          {activeAction === 'cleanup' && running ? td.running : td.cleanup}
        </button>

        {running && (
          <span style={styles.timer}>{formatTime(elapsed)}</span>
        )}
      </div>

      {showStepper && (
        <DeployStepper
          phases={phases}
          activePhaseIdx={activePhaseIdx}
          result={result}
          i18n={i18n}
        />
      )}

      {/* Collapsible LogViewer */}
      <div style={styles.logSection}>
        <button
          onClick={() => setLogsExpanded((v) => !v)}
          style={styles.logToggle}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: logsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {logsExpanded ? td.hideLogs : td.showLogs}
        </button>

        {logsExpanded && <LogViewer logs={logs} running={running} />}
      </div>

      {result && (
        <div
          style={{
            ...styles.resultBar,
            background:
              result === 'success'
                ? 'rgba(34,197,94,0.1)'
                : 'rgba(239,68,68,0.1)',
            borderColor:
              result === 'success' ? '#22c55e33' : '#ef444433',
          }}
        >
          <span style={{ color: result === 'success' ? '#22c55e' : '#ef4444' }}>
            {result === 'success' ? td.success : td.failed}
          </span>
        </div>
      )}

      <div style={styles.actions}>
        <button onClick={onBack} style={styles.backBtn}>
          {t.nav.back}
        </button>
        <button
          onClick={onNext}
          disabled={running}
          style={{
            ...styles.primaryBtn,
            opacity: running ? 0.4 : 1,
          }}
        >
          {t.nav.finish}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    animation: 'fadeIn 0.3s ease',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#f1f5f9',
  },
  description: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '20px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionBtn: {
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
  testBtn: {
    background: 'linear-gradient(135deg, #F5900D, #E07D00)',
  },
  cleanupBtn: {
    background: '#7f1d1d',
  },
  timer: {
    fontSize: '12px',
    color: '#94a3b8',
    fontFamily: '"SF Mono", "Fira Code", monospace',
    marginLeft: '4px',
  },
  logSection: {
    marginBottom: '8px',
  },
  logToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '6px 0',
    marginBottom: '6px',
    fontWeight: 500,
  },
  resultBar: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: 600,
    marginTop: '16px',
    marginBottom: '24px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '24px',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #2a2a3e',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #F5900D, #E07D00)',
    border: 'none',
    color: '#fff',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
