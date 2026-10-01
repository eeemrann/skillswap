/** Clerk theme that follows the app's design tokens, so the hosted components feel native. */
export const authAppearance = {
  variables: {
    colorPrimary: '#5b5bf0',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 'none', background: 'transparent' },
    card: { width: '100%', boxShadow: 'none', border: 'none', padding: 0, background: 'transparent' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    header: { display: 'none' },
    footer: { display: 'none' },
    formButtonPrimary: { minHeight: '44px', fontWeight: 600, boxShadow: 'none' },
    formFieldInput: { minHeight: '44px' },
    socialButtonsBlockButton: { minHeight: '44px' }
  }
};
