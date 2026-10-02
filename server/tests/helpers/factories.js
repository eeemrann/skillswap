const { User, Booking, TeacherApplication } = require('../../models');

let counter = 0;

/** A learner: no teaching profile, 5 spendable credits unless overridden. */
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: `Member ${counter}`,
    email: `member${counter}-${Date.now()}@example.com`,
    clerkId: `clerk_${counter}_${Date.now()}`,
    skillsWanted: ['Python'],
    creditBalance: 5,
    ...overrides
  });
};

/** A verified teacher who teaches React and Node.js at 1 credit per hour and starts with an empty wallet. */
const makeTeacher = ({ teacherProfile = {}, ...overrides } = {}) => makeUser({
  skillsWanted: [],
  creditBalance: 0,
  skillsOffered: ['React', 'Node.js'],
  verifiedSkills: ['React', 'Node.js'],
  teacherStatus: 'approved',
  teacherProfile: {
    teacherType: 'industry_professional', tier: 'standard', headline: 'Senior engineer teaching React and Node.js',
    organization: 'Acme Corp', jobTitle: 'Staff Engineer', yearsExperience: 8, hourlyRateCredits: 1, verifiedAt: new Date(),
    credentials: [{ kind: 'employment', title: 'Staff Engineer', issuer: 'Acme Corp' }],
    ...teacherProfile
  },
  ...overrides
});

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000);
const daysAgo = (days) => new Date(Date.now() - days * 86400000);

const makeBooking = (requester, provider, overrides = {}) => Booking.create({
  requester: requester._id,
  provider: provider._id,
  skill: 'React',
  proposedTime: hoursFromNow(24),
  durationMinutes: 60,
  credits: 1,
  ...overrides
});

/** An application that passes validation; override fields to test individual rules. */
const applicationInput = (overrides = {}) => ({
  teacherType: 'university_lecturer',
  headline: 'Lecturer in distributed systems teaching Go and system design',
  statement: 'I have taught distributed systems to undergraduates for six years and mentor graduate students on production Go services.',
  organization: 'Example University',
  jobTitle: 'Senior Lecturer',
  yearsExperience: 6,
  skills: ['Go', 'System Design'],
  proposedRateCredits: 2,
  credentials: [{ kind: 'degree', title: 'PhD Computer Science', issuer: 'Example University', year: 2018, url: 'https://example.edu/phd' }],
  links: { institutionProfile: 'https://example.edu/staff/jane', linkedin: 'https://www.linkedin.com/in/jane' },
  institutionalEmail: 'jane@example.edu',
  ...overrides
});

const makeApplication = (user, overrides = {}) => TeacherApplication.create({ user: user._id, ...applicationInput(), ...overrides });

module.exports = { makeUser, makeTeacher, makeBooking, makeApplication, applicationInput, hoursFromNow, daysAgo };
