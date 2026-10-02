export const TEACHER_TYPE_LABEL = {
  university_lecturer: 'University lecturer',
  industry_professional: 'Industry professional',
  certified_trainer: 'Certified trainer',
  independent_expert: 'Independent expert'
};

export const TEACHER_TYPE_HINT = {
  university_lecturer: 'You teach at a university or research institute.',
  industry_professional: 'You build software or data products for an employer or your own company.',
  certified_trainer: 'You hold a vendor or professional certification and train others.',
  independent_expert: 'You are a freelancer, open-source maintainer or author with proven work.'
};

export const TEACHER_TYPE_ICON = {
  university_lecturer: 'users',
  industry_professional: 'bolt',
  certified_trainer: 'shield',
  independent_expert: 'spark'
};

export const CREDENTIAL_KIND_LABEL = {
  degree: 'Degree',
  certification: 'Certification',
  employment: 'Employment',
  publication: 'Publication or talk',
  portfolio: 'Portfolio or open source'
};

export const TIER_LABEL = { standard: 'Verified', expert: 'Expert' };

export const APPLICATION_STATUS = {
  pending: { label: 'In review', tone: 'warning' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Changes needed', tone: 'danger' },
  revoked: { label: 'Removed', tone: 'danger' },
  none: { label: 'Not applied', tone: '' }
};

/** 0.5, 0.75, … up to the cap, for a price dropdown. */
export const rateOptions = ({ min = 0.5, step = 0.25, cap = 3 } = {}) => {
  const options = [];
  for (let value = min; value <= cap + 1e-9; value += step) options.push(Math.round(value * 100) / 100);
  return options;
};

export const HOST_LABEL = { 'linkedin.com': 'LinkedIn', 'github.com': 'GitHub' };
