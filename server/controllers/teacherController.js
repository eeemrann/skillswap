const { TeacherApplication } = require('../models');
const { TEACHER_RATES, TEACHER_TYPES, TEACHER_TIERS, rateCapFor } = require('../config/plans');
const { CATEGORIES } = require('../config/catalog');
const { submitApplication, sendInstitutionalCode, verifyInstitutionalCode, updateTeaching } = require('../services/teacherService');

/** The applicant's own view of their application: the decision reason is shown, internal notes never. */
const serializeApplication = (application) => {
  if (!application) return null;
  const plain = application.toObject ? application.toObject() : { ...application };
  delete plain.reviewNotes;
  delete plain.reviewedBy;
  return plain;
};

const teachingSettings = (user) => ({
  hourlyRateCredits: user.teacherProfile?.hourlyRateCredits ?? TEACHER_RATES.default,
  tier: user.teacherProfile?.tier || 'standard',
  rateCap: rateCapFor(user.teacherProfile?.tier || 'standard'),
  rateMin: TEACHER_RATES.min,
  rateStep: TEACHER_RATES.step,
  verifiedSkills: user.verifiedSkills || [],
  skillsOffered: user.skillsOffered || []
});

/** Application status, the form's previous answers, and the rules the form is validated against. */
exports.getMine = async (req, res) => {
  const application = await TeacherApplication.findOne({ user: req.userId });
  res.json({
    status: req.user.teacherStatus || 'none',
    application: serializeApplication(application),
    teaching: req.user.teacherStatus === 'approved' ? teachingSettings(req.user) : null,
    rules: {
      teacherTypes: TEACHER_TYPES,
      tiers: TEACHER_TIERS,
      categories: CATEGORIES,
      rateMin: TEACHER_RATES.min,
      rateStep: TEACHER_RATES.step,
      rateCaps: TEACHER_RATES.caps,
      defaultRate: TEACHER_RATES.default
    }
  });
};

exports.submit = async (req, res) => {
  const application = await submitApplication(req.user, req.body || {});
  res.json(serializeApplication(application));
};

exports.sendEmailCode = async (req, res) => {
  res.json(await sendInstitutionalCode(req.user, req.body?.email));
};

exports.verifyEmailCode = async (req, res) => {
  res.json(await verifyInstitutionalCode(req.user, req.body?.email, req.body?.code));
};

exports.updateTeaching = async (req, res) => {
  const user = await updateTeaching(req.user, { hourlyRateCredits: req.body?.hourlyRateCredits === undefined ? undefined : Number(req.body.hourlyRateCredits), skillsOffered: req.body?.skillsOffered });
  res.json(teachingSettings(user));
};
