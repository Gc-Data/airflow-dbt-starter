import React, { useState } from 'react'

export default function StepForm({
  step,
  stepIndex,
  totalDynamicSteps,
  values,
  onChange,
  t,
  i18n,
  onNext,
  onBack,
}) {
  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    for (const field of step.fields || []) {
      const val = values[field.id]

      // Required check
      if (field.required && (val === undefined || val === '' || val === null)) {
        newErrors[field.id] = t.validation.required
        continue
      }

      // Pattern validation
      if (field.validation?.pattern && val) {
        const regex = new RegExp(field.validation.pattern)
        if (!regex.test(val)) {
          newErrors[field.id] = i18n(field.validation.message) || t.validation.invalidUrl
        }
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const renderField = (field) => {
    const value = values[field.id]
    const error = errors[field.id]
    const label = i18n(field.label)
    const help = i18n(field.help)
    const placeholder = field.placeholder || ''

    const fieldStyle = {
      ...styles.input,
      ...(error ? { borderColor: '#ef4444' } : {}),
    }

    let input
    switch (field.type) {
      case 'select':
        input = (
          <select
            value={value ?? field.default ?? ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={fieldStyle}
          >
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {i18n(opt.label)}
              </option>
            ))}
          </select>
        )
        break

      case 'toggle':
        input = (
          <label style={styles.toggleContainer}>
            <input
              type="checkbox"
              checked={value ?? field.default ?? false}
              onChange={(e) => onChange(field.id, e.target.checked)}
              style={styles.toggleInput}
            />
            <span
              style={{
                ...styles.toggleTrack,
                background: (value ?? field.default) ? '#F5900D' : '#2a2a3e',
              }}
            >
              <span
                style={{
                  ...styles.toggleThumb,
                  transform: (value ?? field.default) ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </span>
          </label>
        )
        break

      case 'password':
        input = (
          <input
            type="password"
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={fieldStyle}
          />
        )
        break

      case 'number':
        input = (
          <input
            type="number"
            value={value ?? field.default ?? ''}
            min={field.min}
            max={field.max}
            placeholder={placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={fieldStyle}
          />
        )
        break

      case 'textarea':
        input = (
          <textarea
            value={value ?? ''}
            rows={field.rows || 4}
            placeholder={placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={{ ...fieldStyle, resize: 'vertical', minHeight: '80px' }}
          />
        )
        break

      case 'multiselect':
        input = (
          <div style={styles.multiselect}>
            {(field.options || []).map((opt) => {
              const selected = (value || []).includes(opt.value)
              return (
                <label key={opt.value} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const current = value || []
                      if (e.target.checked) {
                        onChange(field.id, [...current, opt.value])
                      } else {
                        onChange(field.id, current.filter((v) => v !== opt.value))
                      }
                    }}
                    style={styles.checkbox}
                  />
                  <span>{i18n(opt.label)}</span>
                </label>
              )
            })}
          </div>
        )
        break

      default:
        // text, url, file
        input = (
          <input
            type={field.type === 'url' ? 'url' : 'text'}
            value={value ?? field.default ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={fieldStyle}
          />
        )
    }

    return (
      <div key={field.id} style={styles.fieldGroup}>
        <label style={styles.label}>
          {label}
          {field.required && <span style={styles.requiredStar}> *</span>}
        </label>
        {input}
        {help && <p style={styles.help}>{help}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.stepIndicator}>
        {t.steps.step} {stepIndex + 1} {t.steps.of} {totalDynamicSteps}
      </div>
      <h2 style={styles.title}>{i18n(step.title)}</h2>
      {step.description && (
        <p style={styles.description}>{i18n(step.description)}</p>
      )}

      <div style={styles.form}>
        {(step.fields || []).map(renderField)}
      </div>

      <div style={styles.actions}>
        <button onClick={onBack} style={styles.backBtn}>
          {t.nav.back}
        </button>
        <button onClick={handleNext} style={styles.primaryBtn}>
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
  stepIndicator: {
    fontSize: '12px',
    color: '#F5900D',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginBottom: '32px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  requiredStar: {
    color: '#ef4444',
  },
  input: {
    background: '#111118',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '14px',
    width: '100%',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  help: {
    fontSize: '12px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  error: {
    fontSize: '12px',
    color: '#ef4444',
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  toggleInput: {
    display: 'none',
  },
  toggleTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    position: 'relative',
    transition: 'background 0.2s',
    display: 'inline-block',
  },
  toggleThumb: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
  },
  multiselect: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: '#F5900D',
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
