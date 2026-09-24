export const authAppearance = {
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#0a0a0a',
    colorText: '#ffffff',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#000000',
    colorInputText: '#ffffff',
    colorInputPlaceholder: '#a1a1aa',
    borderRadius: '8px',
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
      padding: '24px'
    },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    otpCodeFieldInput: {
      border: '1px solid rgba(255, 255, 255, 0.3) !important',
      backgroundColor: '#111 !important',
      color: '#fff !important',
      fontWeight: '700',
      '&:focus': { borderColor: '#6366f1 !important', boxShadow: '0 0 0 1px #6366f1' }
    },
    formFieldLabel: {
      color: '#a1a1aa',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '6px'
    },
    formFieldInput: {
      width: '100%',
      boxSizing: 'border-box',
      height: '40px',
      backgroundColor: '#000',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.15)',
      fontSize: '14px',
      boxShadow: 'none',
      '&::placeholder': { color: '#a1a1aa !important', opacity: '1 !important' },
      '&:focus': { borderColor: '#6366f1', boxShadow: '0 0 0 1px #6366f1' }
    },
    socialButtonsBlockButton: {
      width: '100%',
      height: '40px',
      backgroundColor: '#111',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.1)',
      '&:hover': { backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.2)' }
    },
    dividerLine: { backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#a1a1aa' },
    formButtonPrimary: {
      height: '40px',
      fontSize: '14px',
      textTransform: 'none',
      backgroundColor: '#6366f1',
      boxShadow: 'none',
      '&:hover': { backgroundColor: '#4f46e5' }
    },
    footer: { display: 'none' },
    identityPreviewText: { color: '#fff' },
    identityPreviewEditButtonIcon: { color: '#6366f1' }
  }
};
