import React, { useState } from 'react'

export default function StepReview({
  steps,
  values,
  t,
  i18n,
  onEdit,
  onNext,
  onBack,
  configResult,
  setConfigResult,
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = () => {
    setGenerating(true)
    setError(null)
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setConfigResult(data)
        }
        setGenerating(false)
      })
      .catch((err) => {
        setError(err.message)
        setGenerating(false)
      })
  }

  const resolveDisplayValue = (field, val) => {
    if (val === undefined || val === null) return '-'
    if (typeof val === 'boolean') return val ? t.review.true : t.review.false
    if (field.type === 'select' && field.options) {
      const opt = field.options.find((o) => o.value === val)
      if (opt) return i18n(opt.label)
    }
    if (field.type === 'password' && val) return '\u2022'.repeat(8)
    if (Array.isArray(val)) return val.join(', ')
    return String(val)
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{t.review.title}</h2>
      <p style={styles.description}>{t.review.description}</p>

      <div style={styles.sections}>
        {steps.map((step, idx) => (
          <div key={step.id} style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>{i18n(step.title)}</h3>
              <button onClick={() => onEdit(idx)} style={styles.editBtn}>
                {t.review.edit}
              </button>
            </div>
            <div style={styles.fields}>
              {(step.fields || []).map((field) => (
                <div key={field.id} style={styles.fieldRow}>
                  <span style={styles.fieldLabel}>{i18n(field.label)}</span>
                  <span style={styles.fieldValue}>
                    {resolveDisplayValue(field, values[field.id])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {configResult && (
        <div style={styles.successBox}>
          <span style={styles.successIcon}>{'\u2713'}</span>
          <div>
            <p style={styles.successText}>{t.review.configGenerated}</p>
            <p style={styles.filesText}>
              {t.review.filesGenerated}: {configResult.files_generated?.join(', ')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <p>{error}</p>
        </div>
      )}

      <div style={styles.actions}>
        <button onClick={onBack} style={styles.backBtn}>
          {t.nav.back}
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              ...styles.secondaryBtn,
              opacity: generating ? 0.5 : 1,
            }}
          >
            {generating ? t.review.generating : t.review.generateConfig}
          </button>
          <button
            onClick={onNext}
            disabled={!configResult}
            style={{
              ...styles.primaryBtn,
              opacity: configResult ? 1 : 0.4,
              cursor: configResult ? 'pointer' : 'not-allowed',
            }}
          >
            {t.nav.next}
          </button>
        </div>
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
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  section: {
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: '10px',
    padding: '18px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  editBtn: {
    background: 'transparent',
    border: '1px solid #2a2a3e',
    color: '#F5900D',
    borderRadius: '6px',
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },
  fieldLabel: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  fieldValue: {
    fontSize: '13px',
    color: '#e2e8f0',
    fontWeight: 500,
    textAlign: 'right',
    maxWidth: '60%',
    wordBreak: 'break-all',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid #22c55e33',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  successIcon: {
    color: '#22c55e',
    fontSize: '18px',
    fontWeight: 700,
  },
  successText: {
    color: '#22c55e',
    fontSize: '13px',
    fontWeight: 600,
  },
  filesText: {
    color: '#64748b',
    fontSize: '12px',
    marginTop: '2px',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid #ef444433',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#ef4444',
    fontSize: '13px',
    marginBottom: '24px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
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
