export const authAppearance = {
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#0a0a0a',
    colorText: '#ffffff',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#111111',
    colorInputText: '#ffffff',
    borderRadius: '10px',
    fontFamily: 'Inter, sans-serif'
  },
  elements: {
    rootBox: { width: '100%', maxWidth: '100%' },
    cardBox: { width: '100%', boxShadow: 'none' },
    card: { width: '100%', maxWidth: '100%', boxSizing: 'border-box', backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: '0' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    socialButtonsBlockButton: { width: '100%', minHeight: '44px', backgroundColor: '#111', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { backgroundColor: '#18181b' } },
    dividerLine: { backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#a1a1aa' },
    formFieldLabel: { color: '#a1a1aa', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
    formFieldInput: { width: '100%', boxSizing: 'border-box', minHeight: '44px', backgroundColor: '#000', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'none', '&:focus': { borderColor: '#6366f1' } },
    formButtonPrimary: { minHeight: '44px', backgroundColor: '#6366f1', boxShadow: 'none', '&:hover': { backgroundColor: '#4f46e5' } },
    footer: { background: 'transparent' },
    footerActionLink: { color: '#6366f1', '&:hover': { color: '#818cf8' } }
  }
};
