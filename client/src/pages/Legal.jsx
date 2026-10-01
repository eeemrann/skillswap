import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useDocumentTitle } from '../lib/hooks';

const UPDATED = 'October 2026';

const DOCS = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using SkillSwap', 'SkillSwap connects members who want to teach and learn skills over live video. You must be at least 18 years old, provide accurate information, and keep your account secure. You are responsible for everything that happens under your account.'],
      ['Credits', 'A credit represents one hour of session time within SkillSwap. Credits are not money, have no cash value, cannot be withdrawn or transferred outside the platform, and do not expire. We may adjust credit balances to correct errors or remedy abuse.'],
      ['Sessions and escrow', 'When a teacher confirms a session, the learner’s credits are reserved. Credits are released to the teacher when the learner confirms the session, or automatically 24 hours after the session if both participants attended. If a session does not take place, reserved credits are returned to the learner.'],
      ['Service fee', 'Members on the Free plan receive 90% of the credits earned from a session; the remaining 10% is retained by SkillSwap as a service fee. Pro members receive 100%. Fees are shown before you confirm a purchase.'],
      ['Payments and subscriptions', 'Payments are processed by Stripe. Subscriptions renew automatically until cancelled; you can cancel at any time from your billing page and keep Pro until the end of the paid period. Credit packs are non-refundable once used, and unused packs can be refunded within 14 days of purchase on request, unless prohibited by law.'],
      ['Conduct', 'Be respectful. Do not harass others, share unlawful or explicit content, impersonate anyone, record sessions without every participant’s consent, solicit payments outside the platform, or misuse the service. We may suspend accounts that break these rules.'],
      ['Your content', 'You keep ownership of what you post. You grant SkillSwap a licence to display your profile and reviews to other members as needed to operate the service.'],
      ['No professional advice', 'Members are independent individuals, not employees or agents of SkillSwap. We do not vet qualifications and do not guarantee any outcome. Sessions are not a substitute for professional, legal, medical or financial advice.'],
      ['Liability', 'To the extent permitted by law, the service is provided “as is” and our total liability is limited to the amount you paid us in the 12 months before the claim.'],
      ['Changes and contact', 'We may update these terms; material changes will be notified in the app. Questions can be sent to the support address shown in your account.']
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we collect', 'Account details from our sign-in provider (name, email, profile photo), the profile information you add (bio, skills, languages, availability, timezone, optional city and country), your bookings, messages, reviews and credit history, and payment status from Stripe. We never see or store full card numbers.'],
      ['Location', 'Location is optional. If you share your device location, we store coordinates only to rank nearby members. Other members never see your coordinates; at most they see the city and country you choose to show. You can remove your location at any time in Profile settings.'],
      ['Video and audio', 'Sessions are peer-to-peer and encrypted in transit. SkillSwap does not record or store audio or video. To connect participants behind strict networks, traffic may pass through a relay server that cannot read it. Chat messages sent during a session are stored with your conversation.'],
      ['How we use data', 'To operate the service, match members, process payments, send booking and receipt emails, prevent fraud and abuse, and improve reliability. We do not sell your personal data.'],
      ['Who we share it with', 'Service providers that help us run SkillSwap: authentication (Clerk), payments (Stripe), email delivery (Resend) and hosting. Other members see your public profile, skills, ratings and reviews.'],
      ['Your rights', 'You can edit your profile, export your data and delete your account from Profile settings. Deleting your account removes your personal information, messages and notifications; anonymised transaction records may be kept for accounting and fraud prevention.'],
      ['Retention and security', 'Notifications are deleted after 90 days and email jobs after 30 days. We use encryption in transit, access controls and monitoring to protect your data, but no system is perfectly secure.'],
      ['Contact', 'For privacy requests, contact the support address shown in your account.']
    ]
  }
};

export default function Legal({ doc }) {
  const { title, sections } = DOCS[doc];
  useDocumentTitle(title);
  return (
    <>
      <SiteHeader />
      <main id="main" className="legal">
        <p className="eyebrow">Legal</p>
        <h1>{title}</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        <p className="alert warning small" style={{ marginTop: 16 }}>This is a plain-language template. Have it reviewed by a lawyer for your jurisdiction and business details before launch.</p>
        {sections.map(([heading, text], index) => (
          <section key={heading}><h2>{index + 1}. {heading}</h2><p className="muted">{text}</p></section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
