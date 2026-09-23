export const authAppearance = {
  variables: {
    colorPrimary: '#6366f1',
    colorText: '#0a0a0a',
    colorTextSecondary: '#737373',
    colorBackground: '#ffffff',
    colorInputBackground: '#fafafa',
    colorInputText: '#0a0a0a',
    borderRadius: '8px',
    fontFamily: 'Inter, sans-serif'
  },
  elements: {
    rootBox: { width: '100%', maxWidth: '100%' },
    cardBox: { width: '100%', boxShadow: 'none' },
    card: { width: '100%', maxWidth: '100%', boxSizing: 'border-box', boxShadow: 'none', border: 'none', padding: '0' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    formFieldLabel: { color: '#404040', fontSize: '12px', fontWeight: '600' },
    formFieldInput: { width: '100%', boxSizing: 'border-box', minHeight: '44px', background: '#fafafa', border: '1px solid #eaeaea', color: '#0a0a0a', borderRadius: '8px', boxShadow: 'none' },
    socialButtonsBlockButton: { width: '100%', minHeight: '44px', boxSizing: 'border-box', marginInline: 0, border: '1px solid #eaeaea', borderRadius: '8px', background: '#ffffff', color: '#0a0a0a', boxShadow: 'none', '&:hover': { backgroundColor: '#fafafa' } },
    formButtonPrimary: { minHeight: '44px', borderRadius: '8px', backgroundColor: '#0a0a0a', boxShadow: 'none', '&:hover': { backgroundColor: '#171717' } },
    footer: { background: 'transparent' },
    footerActionLink: { color: '#6366f1', fontWeight: '600' },
    dividerLine: { background: '#eaeaea' },
    dividerText: { color: '#737373' }
  }
};
