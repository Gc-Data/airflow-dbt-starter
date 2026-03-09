import React, { useState, useEffect, useCallback } from 'react'

const STATUS = {
  PENDING: 'pending',
  CHECKING: 'checking',
  OK: 'ok',
  MISSING: 'missing',
}

export default function StepPrerequisites({ t, onNext, onBack }) {
  const [items, setItems] = useState([])
  const [allOk, setAllOk] = useState(false)
  const [finished, setFinished] = useState(false)
  const [checking, setChecking] = useState(false)

  const runCheck = useCallback(() => {
    setItems([])
    setAllOk(false)
    setFinished(false)
    setChecking(true)

    fetch('/api/prerequisites/stream')
      .then((response) => {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setChecking(false)
              setFinished(true)
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.type === 'init') {
                    // Initialize all items as pending
                    setItems(
                      data.items.map((item) => ({
                        ...item,
                        status: STATUS.PENDING,
                        version: null,
                      }))
                    )
                  } else if (data.type === 'checking') {
                    // Mark this item as currently being checked
                    setItems((prev) =>
                      prev.map((item, idx) =>
                        idx === data.index
                          ? { ...item, status: STATUS.CHECKING }
                          : item
                      )
                    )
                  } else if (data.type === 'result') {
                    // Update item with result
                    setItems((prev) =>
                      prev.map((item, idx) =>
                        idx === data.index
                          ? { ...item, status: data.status, version: data.version }
                          : item
                      )
                    )
                  } else if (data.type === 'done') {
                    setAllOk(data.all_ok)
                    setChecking(false)
                    setFinished(true)
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
      .catch(() => {
        setChecking(false)
        setFinished(true)
      })
  }, [])

  useEffect(() => {
    runCheck()
  }, [runCheck])

  const tp = t.prerequisites

  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.PENDING:
        return <span style={styles.iconPending}>{'\u2022'}</span>
      case STATUS.CHECKING:
        return <div style={styles.spinnerSmall} />
      case STATUS.OK:
        return <span style={styles.iconOk}>{'\u2713'}</span>
      case STATUS.MISSING:
        return <span style={styles.iconMissing}>{'\u2717'}</span>
      default:
        return <span style={styles.iconPending}>{'\u2022'}</span>
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case STATUS.PENDING:
        return ''
      case STATUS.CHECKING:
        return tp.checking
      case STATUS.OK:
        return tp.ok
      case STATUS.MISSING:
        return tp.missing
      default:
        return ''
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{tp.title}</h2>
      <p style={styles.description}>{tp.description}</p>

      <div style={styles.list}>
        {items.length === 0 && checking && (
          <div style={styles.checkingRow}>
            <div style={styles.spinnerSmall} />
            <span>{tp.checking}</span>
          </div>
        )}

        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              ...styles.item,
              ...(item.status === STATUS.CHECKING ? styles.itemActive : {}),
              ...(item.status === STATUS.PENDING ? styles.itemDimmed : {}),
            }}
          >
            <div style={styles.itemLeft}>
              <div style={styles.iconContainer}>{getStatusIcon(item.status)}</div>
              <div>
                <span style={styles.itemName}>{item.name}</span>
                {item.version && (
                  <span style={styles.itemVersion}>{item.version}</span>
                )}
                {item.status === STATUS.CHECKING && (
                  <span style={styles.itemChecking}>{tp.checking}</span>
                )}
              </div>
            </div>
            <div style={styles.itemRight}>
              {item.required ? (
                <span style={styles.badgeRequired}>{tp.required}</span>
              ) : (
                <span style={styles.badgeOptional}>{tp.optional}</span>
              )}
              {item.status !== STATUS.PENDING && item.status !== STATUS.CHECKING && (
                <span
                  style={{
                    ...styles.statusLabel,
                    color: item.status === STATUS.OK ? '#22c55e' : '#ef4444',
                  }}
                >
                  {getStatusLabel(item.status)}
                </span>
              )}
              {item.status === STATUS.MISSING && item.install_url && (
                <a
                  href={item.install_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.installLink}
                >
                  {tp.install} &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {finished && (
        <div
          style={{
            ...styles.statusBar,
            background: allOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            borderColor: allOk ? '#22c55e33' : '#ef444433',
          }}
        >
          <span style={{ color: allOk ? '#22c55e' : '#ef4444' }}>
            {allOk ? tp.allOk : tp.someMissing}
          </span>
        </div>
      )}

      <div style={styles.actions}>
        <button onClick={onBack} style={styles.backBtn}>
          {t.nav.back}
        </button>
        <button
          onClick={runCheck}
          disabled={checking}
          style={{
            ...styles.secondaryBtn,
            opacity: checking ? 0.5 : 1,
          }}
        >
          {checking ? tp.checking : tp.checkAgain}
        </button>
        <button
          onClick={onNext}
          disabled={!allOk}
          style={{
            ...styles.primaryBtn,
            opacity: allOk ? 1 : 0.4,
            cursor: allOk ? 'pointer' : 'not-allowed',
          }}
        >
          {t.nav.next}
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
    marginBottom: '24px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  checkingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#94a3b8',
    padding: '16px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: '10px',
    padding: '14px 18px',
    transition: 'all 0.3s ease',
  },
  itemActive: {
    borderColor: '#F5900D44',
    background: '#111122',
    boxShadow: '0 0 0 1px rgba(245,144,13,0.15)',
  },
  itemDimmed: {
    opacity: 0.4,
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconContainer: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPending: {
    color: '#4a5568',
    fontSize: '18px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOk: {
    color: '#22c55e',
    fontSize: '16px',
    fontWeight: 700,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(34,197,94,0.1)',
    borderRadius: '50%',
    animation: 'fadeIn 0.3s ease',
  },
  iconMissing: {
    color: '#ef4444',
    fontSize: '16px',
    fontWeight: 700,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: '50%',
    animation: 'fadeIn 0.3s ease',
  },
  spinnerSmall: {
    width: '18px',
    height: '18px',
    border: '2px solid #2a2a3e',
    borderTopColor: '#F5900D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  itemName: {
    fontWeight: 600,
    fontSize: '14px',
    display: 'block',
  },
  itemVersion: {
    fontSize: '12px',
    color: '#22c55e',
    display: 'block',
    marginTop: '2px',
    animation: 'fadeIn 0.3s ease',
  },
  itemChecking: {
    fontSize: '12px',
    color: '#F5900D',
    display: 'block',
    marginTop: '2px',
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  badgeRequired: {
    fontSize: '11px',
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  badgeOptional: {
    fontSize: '11px',
    color: '#64748b',
    background: '#1e1e2e',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  statusLabel: {
    fontSize: '11px',
    fontWeight: 600,
  },
  installLink: {
    fontSize: '12px',
    color: '#F5900D',
    textDecoration: 'none',
  },
  statusBar: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    marginBottom: '24px',
    animation: 'fadeIn 0.3s ease',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
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
  secondaryBtn: {
    background: '#1e1e2e',
    border: '1px solid #2a2a3e',
    color: '#e2e8f0',
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
