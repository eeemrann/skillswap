import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useDocumentTitle } from '../lib/hooks';

const UPDATED = 'October 2026';

const DOCS = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using SkillSwap', 'SkillSwap is a marketplace that connects learners with verified teachers for live one-to-one video lessons in technology. You must be at least 18 years old, provide accurate information, and keep your account secure. You are responsible for everything that happens under your account.'],
      ['Credits', 'Credits are the currency used to pay for sessions. New members receive welcome credits. Additional credits can be bought in packs or included with a subscription. Credits you buy or receive for free can only be used for sessions; they cannot be withdrawn, transferred or exchanged for money. Credits do not expire. We may adjust credit balances to correct errors or remedy abuse.'],
      ['Teachers and verification', 'Only teachers approved by SkillSwap can be booked. To apply you must provide accurate information about your qualifications and experience, and links or documents a reviewer can check. We decide at our discretion, may ask for more evidence, and may remove a teacher at any time, for example for misrepresenting credentials. Approval is not an endorsement or a guarantee of outcomes. Teachers are independent professionals, not employees or agents of SkillSwap.'],
      ['Session prices and escrow', 'Each teacher sets an hourly price in credits within the limits for their tier. When a teacher confirms a session, the learner’s credits are reserved. Credits are released to the teacher when the learner confirms the session, or automatically 24 hours after the session if both participants attended. If a session does not take place, reserved credits are returned to the learner.'],
      ['Platform fee', 'SkillSwap keeps a platform fee from the credits a teacher earns for each session: 12% on the Free plan and 6% on Pro. The fee is deducted when the session settles, and the teacher receives the rest as earned credits. Learners never pay a fee on top of the session price.'],
      ['Earnings and withdrawals', 'Credits earned by teaching can be withdrawn to a bank account through Stripe Connect at the cash-out rate shown in your wallet, above the minimum withdrawal amount. Earnings become withdrawable after a clearing period of a few days. Teachers must complete Stripe’s identity verification, and are responsible for taxes on their income. Large withdrawals may be reviewed before they are sent, and we may delay or refuse a withdrawal that we reasonably suspect is fraudulent, linked to abuse of free credits, or the subject of a payment dispute.'],
      ['Payments and subscriptions', 'Payments are processed by Stripe. Subscriptions renew automatically until cancelled; you can cancel at any time from your billing page and keep Pro until the end of the paid period. Unused credit packs can be refunded within 14 days of purchase on request, unless prohibited by law. Credits that have already been spent on sessions are not refundable.'],
      ['Conduct', 'Be respectful. Do not harass others, share unlawful or explicit content, impersonate anyone, record sessions without every participant’s consent, solicit payments outside the platform, create multiple accounts to collect free credits, or misuse the service. We may suspend accounts that break these rules and withhold related earnings.'],
      ['Your content', 'You keep ownership of what you post. You grant SkillSwap a licence to display your profile, credentials summary and reviews to other members as needed to operate the service.'],
      ['No professional advice', 'Sessions are educational. We do not guarantee any result, job outcome or certification, and sessions are not a substitute for professional, legal or financial advice.'],
      ['Liability', 'To the extent permitted by law, the service is provided “as is” and our total liability is limited to the amount you paid us in the 12 months before the claim.'],
      ['Changes and contact', 'We may update these terms; material changes will be notified in the app. Questions can be sent to the support address shown in your account.']
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we collect', 'Account details from our sign-in provider (name, email, profile photo), the profile information you add (bio, skills, languages, availability, timezone, optional city and country), your bookings, messages, reviews and credit history, and payment status from Stripe. Teacher applicants also give us their credentials, links and, optionally, a work or university email address. Teachers who withdraw earnings complete identity and bank verification directly with Stripe; we never see or store bank details or full card numbers.'],
      ['Location', 'Location is optional. If you share your device location, we store coordinates only to rank nearby members. Other members never see your coordinates; at most they see the city and country you choose to show. You can remove your location at any time in Profile settings.'],
      ['Video and audio', 'Sessions are peer-to-peer and encrypted in transit. SkillSwap does not record or store audio or video. To connect participants behind strict networks, traffic may pass through a relay server that cannot read it. Chat messages sent during a session are stored with your conversation.'],
      ['How we use data', 'To operate the service, match members, process payments, send booking and receipt emails, prevent fraud and abuse, and improve reliability. We do not sell your personal data.'],
      ['Who we share it with', 'Service providers that help us run SkillSwap: authentication (Clerk), payments and payouts (Stripe), email delivery (Resend) and hosting. Other members see your public profile, skills, ratings and reviews. Verified teachers’ public profiles show a summary of their verified credentials (type, title, issuer, year); the links and documents they submitted are only seen by our reviewers.'],
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
