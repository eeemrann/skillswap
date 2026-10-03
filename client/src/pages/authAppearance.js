/** Clerk theme that follows the app's design tokens (light + dark), so the hosted components feel native. */
export const authAppearance = {
  variables: {
    colorPrimary: 'var(--brand)',
    colorText: 'var(--text)',
    colorTextSecondary: 'var(--text-2)',
    colorTextOnPrimaryBackground: '#ffffff',
    colorBackground: 'var(--surface)',
    colorInputBackground: 'var(--surface)',
    colorInputText: 'var(--text)',
    colorNeutral: 'var(--text)',
    colorDanger: 'var(--danger)',
    colorSuccess: 'var(--success)',
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
    formFieldLabel: { color: 'var(--text)' },
    formFieldInput: { minHeight: '44px', background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-strong)' },
    formFieldInputShowPasswordButton: { color: 'var(--text-3)' },
    formFieldInfoText: { color: 'var(--text-3)' },
    formFieldHintText: { color: 'var(--text-3)' },
    formFieldAction: { color: 'var(--brand-ink)' },
    socialButtonsBlockButton: { minHeight: '44px', background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-strong)' },
    socialButtonsBlockButtonText: { color: 'var(--text)' },
    dividerLine: { background: 'var(--border)' },
    dividerText: { color: 'var(--text-3)' },
    identityPreviewText: { color: 'var(--text)' },
    identityPreviewEditButton: { color: 'var(--brand-ink)' },
    alternativeMethodsBlockButton: { color: 'var(--text)', borderColor: 'var(--border-strong)' },
    otpCodeFieldInput: { color: 'var(--text)', borderColor: 'var(--border-strong)' },
    formResendCodeLink: { color: 'var(--brand-ink)' },
    backLink: { color: 'var(--brand-ink)' }
  }
};
