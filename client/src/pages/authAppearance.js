export const authAppearance = {
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#0a0a0a',
    colorText: '#ffffff',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#000000',
    colorInputText: '#ffffff',
    colorInputPlaceholder: '#71717a',
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif'
  },
  elements: {
    rootBox: { width: '100%', maxWidth: '100%' },
    cardBox: { width: '100%', maxWidth: '100%', boxShadow: 'none' },
    card: {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      backgroundColor: '#0a0a0a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      padding: 'clamp(20px, 4vw, 32px)'
    },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    socialButtonsBlockButton: {
      width: '100%',
      minHeight: '44px',
      backgroundColor: '#111',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.1)',
      '&:hover': { backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.2)' }
    },
    dividerLine: { backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#a1a1aa' },
    formFieldLabel: {
      color: '#a1a1aa',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '8px'
    },
    formFieldInput: {
      width: '100%',
      boxSizing: 'border-box',
      height: '44px',
      backgroundColor: '#000',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.1)',
      fontSize: '14px',
      boxShadow: 'none',
      '&:focus': { borderColor: '#6366f1', boxShadow: '0 0 0 1px #6366f1' }
    },
    formButtonPrimary: {
      minHeight: '44px',
      backgroundColor: '#6366f1',
      boxShadow: 'none',
      '&:hover': { backgroundColor: '#4f46e5' }
    },
    footer: { background: 'transparent' },
    footerActionLink: {
      color: '#6366f1',
      fontWeight: '600',
      '&:hover': { color: '#818cf8' }
    },
    identityPreviewText: { color: '#ffffff' },
    identityPreviewEditButtonIcon: { color: '#6366f1' }
  }
};
