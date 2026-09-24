export const authAppearance = {
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#0a0a0a',
    colorText: '#ffffff',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#000000',
    colorInputText: '#ffffff',
    colorInputPlaceholder: '#71717a', // Makes placeholders visible
    borderRadius: '8px',
    fontFamily: 'Inter, sans-serif'
  },
  elements: {
    rootBox: { width: '100%', maxWidth: '100%' },
    cardBox: { width: '100%', boxShadow: 'none' },
    card: {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      backgroundColor: '#0a0a0a',
      border: '1px solid rgba(255, 255, 255, 0.1)', // The "Vault" border
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      padding: '24px'
    },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    
    /* FIX: Verification Number Boxes */
    otpCodeFieldInput: {
      border: '1px solid rgba(255, 255, 255, 0.3) !important',
      backgroundColor: '#111 !important',
      color: '#fff !important',
      fontWeight: '700',
      '&:focus': { borderColor: '#6366f1 !important', boxShadow: '0 0 0 1px #6366f1' }
    },

    /* FIX: Google Button consistency */
    socialButtonsBlockButton: {
      width: '100%',
      height: '44px',
      backgroundColor: '#000 !important',
      color: '#fff !important',
      border: '1px solid rgba(255,255,255,0.15) !important',
      '&:hover': { backgroundColor: '#111 !important', borderColor: 'rgba(255,255,255,0.3)' }
    },
    socialButtonsBlockButtonText: {
      fontWeight: '600',
      letterSpacing: '0.02em'
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
      '&::placeholder': { color: '#71717a !important', opacity: '1 !important' },
      '&:focus': { borderColor: '#6366f1', boxShadow: '0 0 0 1px #6366f1' }
    },
    dividerLine: { backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#71717a', fontSize: '11px', fontWeight: '600' },
    formButtonPrimary: {
      height: '44px',
      fontSize: '14px',
      fontWeight: '700',
      textTransform: 'none',
      backgroundColor: '#6366f1',
      '&:hover': { backgroundColor: '#4f46e5' }
    },
    footer: { display: 'none' },
    identityPreviewText: { color: '#fff' },
    identityPreviewEditButtonIcon: { color: '#6366f1' }
  }
};