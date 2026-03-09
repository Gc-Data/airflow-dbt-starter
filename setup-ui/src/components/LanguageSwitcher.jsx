import React from 'react'

export default function LanguageSwitcher({ lang, setLang }) {
  return (
    <button
      onClick={() => setLang(lang === 'pt-BR' ? 'en' : 'pt-BR')}
      style={styles.button}
      title={lang === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
    >
      <span style={styles.flag}>{lang === 'pt-BR' ? '🇧🇷' : '🇺🇸'}</span>
      <span style={styles.label}>{lang === 'pt-BR' ? 'PT-BR' : 'EN'}</span>
    </button>
  )
}

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#1e1e2e',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'border-color 0.2s',
  },
  flag: {
    fontSize: '16px',
  },
  label: {
    fontWeight: 500,
  },
}
