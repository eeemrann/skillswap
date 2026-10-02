const crypto = require('crypto');
const { User, TeacherApplication, TeacherEmailCheck, Booking } = require('../models');
const { CREDENTIAL_KINDS, TEACHER_TYPES } = TeacherApplication;
const { normalizeSkills, unknownSkills } = require('../config/catalog');
const { TEACHER_RATES, isValidRate, rateCapFor } = require('../config/plans');
const { appUrl } = require('../config');
const { round2 } = require('../utils/money');
const { HttpError } = require('../utils/transaction');
const { queueEmail, createInAppNotification } = require('./notificationService');
const { closeBooking } = require('./bookingService');

const MAX_SKILLS_PER_APPLICATION = 10;
const MAX_CREDENTIALS = 8;
const CODE_TTL_MINUTES = 15;
const CODE_RESEND_SECONDS = 60;
const CODE_MAX_ATTEMPTS = 5;
const VERIFIED_EMAIL_VALID_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const idOf = (value) => String(value?._id || value);

/** University and research addresses (mit.edu, ox.ac.uk, du.edu.bd, iitb.ac.in…). A hint for reviewers, never proof by itself. */
const isAcademicEmail = (email) => /\.(edu|ac)(\.[a-z]{2,3})?$/i.test(String(email || '').split('@')[1] || '');

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A normalised https URL, '' when absent, or an HttpError for anything else. */
function cleanUrl(value, label) {
  const raw = text(value, 500);
  if (!raw) return '';
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  if (scheme && !/^https?$/i.test(scheme) && !scheme.includes('.')) throw new HttpError(400, `${label} must be a web link`);
  let parsed;
  try { parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new HttpError(400, `${label} is not a valid link`); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new HttpError(400, `${label} must be a web link`);
  if (!parsed.hostname.includes('.')) throw new HttpError(400, `${label} is not a valid link`);
  return parsed.toString();
}

/** Validates and cleans an application form. Everything a reviewer needs to judge a person is required here. */
function cleanApplication(input = {}) {
  const teacherType = String(input.teacherType || '');
  if (!TEACHER_TYPES.includes(teacherType)) throw new HttpError(400, 'Choose how you qualify to teach');

  const headline = text(input.headline, 120);
  if (headline.length < 10) throw new HttpError(400, 'Write a headline of at least 10 characters, e.g. “Senior backend engineer teaching Go and system design”');
  const statement = text(input.statement, 1500);
  if (statement.length < 40) throw new HttpError(400, 'Describe your teaching or mentoring experience in at least 40 characters');

  const organization = text(input.organization, 120);
  const jobTitle = text(input.jobTitle, 120);
  if (['university_lecturer', 'industry_professional'].includes(teacherType) && (!organization || !jobTitle)) {
    throw new HttpError(400, teacherType === 'university_lecturer' ? 'Enter your university and your academic title' : 'Enter your employer and your job title');
  }
  const yearsExperience = Math.floor(Number(input.yearsExperience));
  if (!Number.isFinite(yearsExperience) || yearsExperience < 1 || yearsExperience > 60) throw new HttpError(400, 'Years of experience must be between 1 and 60');

  if (unknownSkills(input.skills).length) throw new HttpError(400, `SkillSwap only covers tech skills from our catalog: ${unknownSkills(input.skills).join(', ')}`);
  const skills = normalizeSkills(input.skills, MAX_SKILLS_PER_APPLICATION + 1);
  if (!skills.length) throw new HttpError(400, 'Choose at least one skill you want to teach');
  if (skills.length > MAX_SKILLS_PER_APPLICATION) throw new HttpError(400, `Apply for up to ${MAX_SKILLS_PER_APPLICATION} skills at a time`);

  const rate = Number(input.proposedRateCredits ?? TEACHER_RATES.default);
  if (!isValidRate(rate, 'expert')) throw new HttpError(400, `Your hourly rate must be between ${TEACHER_RATES.min} and ${rateCapFor('expert')} credits, in steps of ${TEACHER_RATES.step}`);

  const rawCredentials = Array.isArray(input.credentials) ? input.credentials : [];
  if (!rawCredentials.length) throw new HttpError(400, 'Add at least one credential: a degree, certification, employment or published work');
  if (rawCredentials.length > MAX_CREDENTIALS) throw new HttpError(400, `Add at most ${MAX_CREDENTIALS} credentials`);
  const credentials = rawCredentials.map((item, index) => {
    const label = `Credential ${index + 1}`;
    const kind = String(item?.kind || '');
    if (!CREDENTIAL_KINDS.includes(kind)) throw new HttpError(400, `${label}: choose a type`);
    const title = text(item.title, 140);
    const issuer = text(item.issuer, 140);
    if (title.length < 2 || issuer.length < 2) throw new HttpError(400, `${label}: enter its title and who issued it`);
    const year = item.year === undefined || item.year === '' || item.year === null ? undefined : Math.floor(Number(item.year));
    if (year !== undefined && (!Number.isFinite(year) || year < 1950 || year > new Date().getFullYear() + 1)) throw new HttpError(400, `${label}: the year looks wrong`);
    return { kind, title, issuer, ...(year ? { year } : {}), url: cleanUrl(item.url, `${label} link`), credentialId: text(item.credentialId, 100) };
  });

  const links = {
    linkedin: cleanUrl(input.links?.linkedin, 'LinkedIn link'),
    github: cleanUrl(input.links?.github, 'GitHub link'),
    website: cleanUrl(input.links?.website, 'Website link'),
    institutionProfile: cleanUrl(input.links?.institutionProfile, 'Staff page link')
  };
  if (!Object.values(links).some(Boolean)) throw new HttpError(400, 'Add at least one link where reviewers can verify you: LinkedIn, GitHub, your staff page or a website');

  const institutionalEmail = text(input.institutionalEmail, 254).toLowerCase();
  if (institutionalEmail && !EMAIL_PATTERN.test(institutionalEmail)) throw new HttpError(400, 'The university or work email is not valid');

  return { teacherType, headline, statement, organization, jobTitle, yearsExperience, skills, proposedRateCredits: rate, credentials, links, institutionalEmail };
}

const publicCredentials = (credentials) => (credentials || []).map(({ kind, title, issuer, year }) => ({ kind, title, issuer, ...(year ? { year } : {}) }));

async function notifyAdmins(message, relatedId) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
  await Promise.all(admins.map((admin) => createInAppNotification({ userId: admin._id, type: 'teacher', message, relatedId })));
}

/** Creates or updates the member's application and queues it for review. */
async function submitApplication(user, input) {
  const fields = cleanApplication(input);
  const verified = fields.institutionalEmail
    ? Boolean(await TeacherEmailCheck.exists({ user: user._id, email: fields.institutionalEmail, verifiedAt: { $exists: true } }))
    : false;

  const application = await TeacherApplication.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        ...fields, institutionalEmailVerified: verified, status: 'pending', submittedAt: new Date(), reviewNotes: '', decisionReason: ''
      },
      $unset: { reviewedBy: 1, reviewedAt: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  if (user.teacherStatus !== 'approved') await User.updateOne({ _id: user._id }, { teacherStatus: 'pending' });

  await notifyAdmins(`${user.name} applied to teach ${fields.skills.slice(0, 2).join(', ')}${fields.skills.length > 2 ? '…' : ''}`, application._id);
  return application;
}

const codeHash = (code, userId, email) => crypto.createHash('sha256').update(`${code}:${idOf(userId)}:${email}`).digest('hex');

/** Emails a six-digit code to the applicant's university or work address. */
async function sendInstitutionalCode(user, rawEmail) {
  const email = text(rawEmail, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid university or work email address');
  const previous = await TeacherEmailCheck.findOne({ user: user._id, email });
  if (previous && !previous.verifiedAt && Date.now() - previous.updatedAt.getTime() < CODE_RESEND_SECONDS * 1000) {
    throw new HttpError(429, 'Please wait a minute before requesting another code');
  }
  if (previous?.verifiedAt && previous.expiresAt > new Date()) return { alreadyVerified: true, academic: isAcademicEmail(email) };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await TeacherEmailCheck.findOneAndUpdate(
    { user: user._id, email },
    { $set: { codeHash: codeHash(code, user._id, email), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000) }, $unset: { verifiedAt: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await queueEmail('TEACHER_EMAIL_CODE', email, { name: user.name, code, minutes: CODE_TTL_MINUTES });
  return { sent: true, academic: isAcademicEmail(email) };
}

/** Checks the code and, if an application already uses this address, marks it verified. */
async function verifyInstitutionalCode(user, rawEmail, rawCode) {
  const email = text(rawEmail, 254).toLowerCase();
  const code = String(rawCode || '').trim();
  const check = await TeacherEmailCheck.findOne({ user: user._id, email });
  if (!check || check.verifiedAt || check.expiresAt <= new Date()) throw new HttpError(400, 'This code has expired. Request a new one.');
  if (check.attempts >= CODE_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes. Request a new one.');

  const expected = Buffer.from(check.codeHash, 'hex');
  const actual = Buffer.from(codeHash(code, user._id, email), 'hex');
  if (!/^\d{6}$/.test(code) || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    await TeacherEmailCheck.updateOne({ _id: check._id }, { $inc: { attempts: 1 } });
    throw new HttpError(400, 'That code is not right');
  }
  await TeacherEmailCheck.updateOne({ _id: check._id }, { $set: { verifiedAt: new Date(), expiresAt: new Date(Date.now() + VERIFIED_EMAIL_VALID_DAYS * 86400000) } });
  await TeacherApplication.updateOne({ user: user._id, institutionalEmail: email }, { institutionalEmailVerified: true });
  await User.updateOne({ _id: user._id, 'teacherProfile.institutionalEmailVerified': { $exists: true } }, { 'teacherProfile.institutionalEmailVerified': true });
  return { verified: true, academic: isAcademicEmail(email) };
}

/** What the reviewer sees at a glance, computed from the application itself. */
function signalsFor(application) {
  const hosts = Object.values(application.links || {}).filter(Boolean).map((link) => {
    try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return ''; }
  }).filter(Boolean);
  return {
    academicEmail: isAcademicEmail(application.institutionalEmail),
    institutionalEmailVerified: Boolean(application.institutionalEmailVerified),
    verifiableCredentials: (application.credentials || []).filter((item) => item.url).length,
    linkHosts: [...new Set(hosts)]
  };
}

/** The admin review queue, oldest first. */
async function listApplications({ status = 'pending', page = 1, limit = 25 } = {}) {
  const filter = status === 'all' ? {} : { status };
  const [items, total] = await Promise.all([
    TeacherApplication.find(filter).populate('user', 'name email profilePicture createdAt teacherStatus timezone').sort({ submittedAt: 1 }).skip((page - 1) * limit).limit(limit),
    TeacherApplication.countDocuments(filter)
  ]);
  return { items: items.map((item) => { const plain = item.toObject(); return { ...plain, signals: signalsFor(plain) }; }), total };
}

/** Approves an application: the member becomes a bookable, verified teacher for the chosen skills. */
async function approveApplication(applicationId, adminId, { skills, tier = 'standard', rateCredits, notes } = {}) {
  const application = await TeacherApplication.findById(applicationId);
  if (!application) throw new HttpError(404, 'Application not found');
  if (application.status !== 'pending') throw new HttpError(409, `This application is already ${application.status}`);
  if (!['standard', 'expert'].includes(tier)) throw new HttpError(400, 'Tier must be standard or expert');

  const chosen = skills === undefined ? application.skills : normalizeSkills(skills).filter((skill) => application.skills.includes(skill));
  if (!chosen.length) throw new HttpError(400, 'Approve at least one of the skills the applicant asked for');

  const user = await User.findById(application.user);
  if (!user || user.status === 'suspended') throw new HttpError(409, 'This member cannot be approved');
  const wasApproved = user.teacherStatus === 'approved';

  const requestedRate = rateCredits ?? (wasApproved ? user.teacherProfile?.hourlyRateCredits : undefined) ?? Math.min(application.proposedRateCredits, rateCapFor(tier));
  const rate = round2(requestedRate);
  if (!isValidRate(rate, tier)) throw new HttpError(400, `A ${tier} teacher's rate must be between ${TEACHER_RATES.min} and ${rateCapFor(tier)} credits per hour, in steps of ${TEACHER_RATES.step}`);

  const verifiedSkills = [...new Set([...(wasApproved ? user.verifiedSkills : []), ...chosen])];
  const skillsOffered = wasApproved ? [...new Set([...user.skillsOffered, ...chosen])] : chosen;
  const now = new Date();

  application.status = 'approved';
  application.approvedSkills = chosen;
  application.tier = tier;
  application.reviewedBy = adminId;
  application.reviewedAt = now;
  application.reviewNotes = text(notes, 1000);
  application.decisionReason = '';
  await application.save();

  await User.updateOne({ _id: user._id }, {
    teacherStatus: 'approved',
    verifiedSkills,
    skillsOffered,
    teacherProfile: {
      teacherType: application.teacherType,
      tier,
      headline: application.headline,
      organization: application.organization,
      jobTitle: application.jobTitle,
      yearsExperience: application.yearsExperience,
      hourlyRateCredits: rate,
      institutionalEmailVerified: application.institutionalEmailVerified,
      verifiedAt: user.teacherProfile?.verifiedAt || now,
      credentials: publicCredentials(application.credentials)
    }
  });

  await Promise.all([
    createInAppNotification({ userId: user._id, type: 'teacher', message: `You are now a verified teacher: ${chosen.join(', ')}`, relatedId: application._id }),
    queueEmail('TEACHER_APPROVED', user.email, { name: user.name, skills: chosen.join(', '), rate: String(rate), url: `${appUrl()}/settings` })
  ]);
  return application;
}

async function rejectApplication(applicationId, adminId, { reason, notes } = {}) {
  const decisionReason = text(reason, 500);
  if (decisionReason.length < 10) throw new HttpError(400, 'Explain what the applicant should fix, in at least 10 characters');
  const application = await TeacherApplication.findById(applicationId);
  if (!application) throw new HttpError(404, 'Application not found');
  if (application.status !== 'pending') throw new HttpError(409, `This application is already ${application.status}`);

  application.status = 'rejected';
  application.decisionReason = decisionReason;
  application.reviewNotes = text(notes, 1000);
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  await application.save();

  const user = await User.findById(application.user).select('name email teacherStatus');
  if (user && user.teacherStatus !== 'approved') await User.updateOne({ _id: user._id }, { teacherStatus: 'rejected' });
  if (user) {
    await Promise.all([
      createInAppNotification({ userId: user._id, type: 'teacher', message: 'Your teacher application needs changes', relatedId: application._id }),
      queueEmail('TEACHER_REJECTED', user.email, { name: user.name, reason: decisionReason, url: `${appUrl()}/teach` })
    ]);
  }
  return application;
}

/** Removes teaching access, cancels sessions that have not happened yet and returns any reserved credits. */
async function revokeTeacher(userId, adminId, reason) {
  const decisionReason = text(reason, 500);
  if (decisionReason.length < 10) throw new HttpError(400, 'A reason of at least 10 characters is required');
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Member not found');
  if (user.teacherStatus !== 'approved') throw new HttpError(409, 'This member is not a verified teacher');

  await User.updateOne({ _id: user._id }, { teacherStatus: 'revoked', skillsOffered: [] });
  await TeacherApplication.updateOne({ user: user._id }, { status: 'revoked', decisionReason, reviewedBy: adminId, reviewedAt: new Date() });

  const open = await Booking.find({
    provider: user._id,
    $or: [{ status: 'pending' }, { status: 'accepted', proposedTime: { $gt: new Date() } }]
  }).select('_id requester skill');
  for (const booking of open) {
    await closeBooking(booking._id, { status: 'cancelled', reason: 'The teacher is no longer available' }).catch((error) => console.error('Cancelling a revoked teacher booking failed:', error.message));
    await createInAppNotification({ userId: booking.requester, type: 'booking', message: `Your ${booking.skill} session was cancelled because the teacher is no longer available. Any held credits were returned.`, relatedId: booking._id });
  }
  await createInAppNotification({ userId: user._id, type: 'teacher', message: 'Your teacher access has been removed', relatedId: user._id });
  return { cancelled: open.length };
}

/** A verified teacher changes their price or which verified skills they list. */
async function updateTeaching(user, { hourlyRateCredits, skillsOffered }) {
  if (user.teacherStatus !== 'approved') throw new HttpError(403, 'Only verified teachers can change teaching settings');
  const tier = user.teacherProfile?.tier || 'standard';
  const update = {};
  if (hourlyRateCredits !== undefined) {
    const rate = round2(hourlyRateCredits);
    if (!isValidRate(rate, tier)) throw new HttpError(400, `Your rate must be between ${TEACHER_RATES.min} and ${rateCapFor(tier)} credits per hour, in steps of ${TEACHER_RATES.step}`);
    update['teacherProfile.hourlyRateCredits'] = rate;
  }
  if (skillsOffered !== undefined) {
    const chosen = normalizeSkills(skillsOffered);
    if (!chosen.length) throw new HttpError(400, 'List at least one skill you teach');
    const outside = chosen.filter((skill) => !user.verifiedSkills.includes(skill));
    if (outside.length) throw new HttpError(403, `${outside.join(', ')} ${outside.length === 1 ? 'has' : 'have'} not been verified for you yet. Request it through your teacher application.`);
    update.skillsOffered = chosen;
  }
  if (Object.keys(update).length) await User.updateOne({ _id: user._id }, { $set: update });
  return User.findById(user._id);
}

module.exports = {
  isAcademicEmail, cleanApplication, submitApplication, sendInstitutionalCode, verifyInstitutionalCode,
  listApplications, approveApplication, rejectApplication, revokeTeacher, updateTeaching, signalsFor, publicCredentials
};
