import React from 'react'

export default function WizardLayout({ currentStep, totalSteps, labels, children }) {
  return (
    <div style={styles.container}>
      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${((currentStep) / (totalSteps - 1)) * 100}%`,
            }}
          />
        </div>
        <div style={styles.dots}>
          {labels.map((label, idx) => (
            <div key={idx} style={styles.dotGroup}>
              <div
                style={{
                  ...styles.dot,
                  ...(idx <= currentStep ? styles.dotActive : {}),
                  ...(idx === currentStep ? styles.dotCurrent : {}),
                }}
              />
              <span
                style={{
                  ...styles.dotLabel,
                  ...(idx === currentStep ? styles.dotLabelActive : {}),
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={styles.content} key={currentStep}>
        {children}
      </div>
    </div>
  )
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 24px',
  },
  progressContainer: {
    marginBottom: '32px',
    position: 'relative',
  },
  progressTrack: {
    height: '3px',
    background: '#1e1e2e',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #F5900D, #E07D00)',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  dots: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    overflow: 'hidden',
  },
  dotGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flex: '0 1 auto',
    minWidth: 0,
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#2a2a3e',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  },
  dotActive: {
    background: '#F5900D',
  },
  dotCurrent: {
    background: '#F5900D',
    boxShadow: '0 0 0 4px rgba(245,144,13,0.2)',
  },
  dotLabel: {
    fontSize: '10px',
    color: '#4a5568',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '80px',
    textAlign: 'center',
  },
  dotLabelActive: {
    color: '#e2e8f0',
    fontWeight: 500,
  },
  content: {
    animation: 'fadeIn 0.3s ease',
  },
}
