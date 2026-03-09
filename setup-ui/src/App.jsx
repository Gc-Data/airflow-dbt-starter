import React, { useState, useEffect, useCallback } from 'react'
import LanguageSwitcher from './components/LanguageSwitcher'
import WizardLayout from './components/WizardLayout'
import StepExistingSetup from './components/StepExistingSetup'
import StepWelcome from './components/StepWelcome'
import StepPrerequisites from './components/StepPrerequisites'
import StepForm from './components/StepForm'
import StepReview from './components/StepReview'
import StepDeploy from './components/StepDeploy'
import StepSuccess from './components/StepSuccess'
import ptBR from './i18n/pt-BR.json'
import en from './i18n/en.json'

const translations = { 'pt-BR': ptBR, en }

function detectLanguage() {
  const nav = navigator.language || navigator.userLanguage || 'en'
  return nav.startsWith('pt') ? 'pt-BR' : 'en'
}

export default function App() {
  const [lang, setLang] = useState(detectLanguage)
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [formValues, setFormValues] = useState({})
  const [configResult, setConfigResult] = useState(null)
  const [envStatus, setEnvStatus] = useState(null)
  const [showWizard, setShowWizard] = useState(false)

  const t = translations[lang] || translations.en

  // Helper to get i18n text from wizard.json fields
  const i18n = useCallback(
    (obj) => {
      if (!obj) return ''
      if (typeof obj === 'string') return obj
      return obj[lang] || obj.en || obj['pt-BR'] || ''
    },
    [lang]
  )

  const fetchStatus = useCallback(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    fetch('/api/status', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setEnvStatus(data))
      .catch(() => {
        setEnvStatus((prev) => prev || { has_env: false, has_compose: false, has_config: false, containers: [], is_running: false })
      })
      .finally(() => clearTimeout(timer))
  }, [])

  useEffect(() => {
    // Load info first (fast, no Docker calls) to unblock rendering.
    // /api/info now includes has_config (filesystem check only) so we
    // can decide wizard vs existing-setup without waiting for /api/status.
    fetch('/api/info')
      .then((r) => r.json())
      .then((infoData) => {
        setInfo(infoData)
        // Initialize form defaults
        const defaults = {}
        for (const step of infoData.template.steps || []) {
          for (const field of step.fields || []) {
            if (field.default !== undefined) {
              defaults[field.id] = field.default
            }
          }
        }
        setFormValues(defaults)
        // Use system lang if available
        if (infoData.system?.lang?.startsWith('pt')) {
          setLang('pt-BR')
        }
        // If no existing config, go straight to wizard
        if (!infoData.has_config) {
          setShowWizard(true)
        }
        setLoading(false)

        // Now fetch full container status in background (slow — calls Docker)
        fetchStatus()
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [fetchStatus])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading wizard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.loadingContainer}>
        <p style={{ ...styles.loadingText, color: '#ef4444' }}>Error: {error}</p>
      </div>
    )
  }

  // Show existing setup screen if config files exist and user hasn't chosen to start wizard.
  // info.has_config comes from /api/info (instant filesystem check).
  // envStatus may still be null while /api/status (Docker) is loading.
  if (info?.has_config && !showWizard) {
    return (
      <div style={styles.app}>
        <header style={styles.header}>
          <div style={styles.logo}>GC Data</div>
          <LanguageSwitcher lang={lang} setLang={setLang} />
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '32px' }}>
          <StepExistingSetup
            status={envStatus}
            t={t}
            onStartWizard={() => setShowWizard(true)}
            onRefreshStatus={fetchStatus}
          />
        </div>
      </div>
    )
  }

  const template = info.template
  const wizardSteps = template.steps || []

  // Steps: Welcome(0) + Prerequisites(1) + dynamic steps(2..N+1) + Review(N+2) + Deploy(N+3) + Success(N+4)
  const totalSteps = 2 + wizardSteps.length + 3
  const dynamicStepStart = 2
  const reviewStep = dynamicStepStart + wizardSteps.length
  const deployStep = reviewStep + 1
  const successStep = deployStep + 1

  const handleFieldChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const goTo = (step) => setCurrentStep(step)
  const next = () => setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))
  const back = () => setCurrentStep((s) => Math.max(s - 1, 0))

  const renderStep = () => {
    if (currentStep === 0) {
      return <StepWelcome template={template} t={t} i18n={i18n} onNext={next} />
    }
    if (currentStep === 1) {
      return <StepPrerequisites t={t} onNext={next} onBack={back} />
    }
    if (currentStep >= dynamicStepStart && currentStep < reviewStep) {
      const idx = currentStep - dynamicStepStart
      const step = wizardSteps[idx]
      return (
        <StepForm
          step={step}
          stepIndex={idx}
          totalDynamicSteps={wizardSteps.length}
          values={formValues}
          onChange={handleFieldChange}
          t={t}
          i18n={i18n}
          onNext={next}
          onBack={back}
        />
      )
    }
    if (currentStep === reviewStep) {
      return (
        <StepReview
          steps={wizardSteps}
          values={formValues}
          t={t}
          i18n={i18n}
          onEdit={(stepIdx) => goTo(dynamicStepStart + stepIdx)}
          onNext={next}
          onBack={back}
          configResult={configResult}
          setConfigResult={setConfigResult}
        />
      )
    }
    if (currentStep === deployStep) {
      return (
        <StepDeploy
          template={template}
          t={t}
          i18n={i18n}
          onNext={next}
          onBack={back}
        />
      )
    }
    if (currentStep === successStep) {
      return (
        <StepSuccess
          template={template}
          t={t}
          i18n={i18n}
          onViewStatus={() => {
            setShowWizard(false)
            fetchStatus()
          }}
        />
      )
    }
    return null
  }

  // Progress bar data
  const progressLabels = [
    t.welcome?.getStarted || 'Welcome',
    t.prerequisites?.title || 'Prerequisites',
    ...wizardSteps.map((s) => i18n(s.title)),
    t.review?.title || 'Review',
    t.deploy?.title || 'Deploy',
    t.success?.title || 'Done',
  ]

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>GC Data</div>
        <LanguageSwitcher lang={lang} setLang={setLang} />
      </header>
      <WizardLayout
        currentStep={currentStep}
        totalSteps={totalSteps}
        labels={progressLabels}
      >
        {renderStep()}
      </WizardLayout>
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: '1px solid #1e1e2e',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#F5900D',
    letterSpacing: '0.5px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #1e1e2e',
    borderTopColor: '#F5900D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '14px',
  },
}

// Inject keyframes for spinner
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0f; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #111118; }
    ::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 4px; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #F5900D !important; box-shadow: 0 0 0 2px rgba(245,144,13,0.2); }
  `
  document.head.appendChild(styleSheet)
}
