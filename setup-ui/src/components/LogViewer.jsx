import React, { useRef, useEffect } from 'react'

export default function LogViewer({ logs, running }) {
  const containerRef = useRef(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  const getLineColor = (line) => {
    const lower = line.toLowerCase()
    if (lower.includes('[error]') || lower.includes('error:') || lower.includes('failed'))
      return '#ef4444'
    if (lower.includes('[warn]') || lower.includes('warning:'))
      return '#f59e0b'
    if (lower.includes('[success]') || lower.includes('done') || lower.includes('started'))
      return '#22c55e'
    return '#94a3b8'
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.dots}>
          <span style={{ ...styles.dot, background: '#ef4444' }} />
          <span style={{ ...styles.dot, background: '#f59e0b' }} />
          <span style={{ ...styles.dot, background: '#22c55e' }} />
        </div>
        <span style={styles.title}>Terminal</span>
        {running && <div style={styles.spinner} />}
      </div>
      <div ref={containerRef} style={styles.body}>
        {logs.length === 0 && !running && (
          <span style={styles.placeholder}>Waiting for output...</span>
        )}
        {logs.map((line, idx) => (
          <div key={idx} style={{ ...styles.line, color: getLineColor(line) }}>
            <span style={styles.lineNumber}>{String(idx + 1).padStart(3, ' ')}</span>
            {line}
          </div>
        ))}
        {running && (
          <div style={styles.cursor}>
            <span style={styles.cursorBlock} />
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#0c0c14',
    border: '1px solid #1e1e2e',
    borderRadius: '10px',
    overflow: 'hidden',
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: '#111118',
    borderBottom: '1px solid #1e1e2e',
  },
  dots: {
    display: 'flex',
    gap: '6px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  title: {
    fontSize: '11px',
    color: '#4a5568',
    flex: 1,
    textAlign: 'center',
  },
  spinner: {
    width: '12px',
    height: '12px',
    border: '2px solid #2a2a3e',
    borderTopColor: '#F5900D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  body: {
    padding: '12px 14px',
    maxHeight: '350px',
    overflowY: 'auto',
    fontSize: '12px',
    lineHeight: '1.7',
  },
  placeholder: {
    color: '#4a5568',
    fontStyle: 'italic',
  },
  line: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  lineNumber: {
    color: '#2a2a3e',
    marginRight: '12px',
    userSelect: 'none',
    display: 'inline-block',
    width: '28px',
    textAlign: 'right',
  },
  cursor: {
    marginTop: '4px',
  },
  cursorBlock: {
    display: 'inline-block',
    width: '7px',
    height: '14px',
    background: '#F5900D',
    animation: 'blink 1s step-end infinite',
  },
}

// Inject blink keyframes
if (typeof document !== 'undefined' && !document.getElementById('logviewer-styles')) {
  const s = document.createElement('style')
  s.id = 'logviewer-styles'
  s.textContent = '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }'
  document.head.appendChild(s)
}
