const { CATEGORIES } = require('../config/catalog');
const { TEACHER_TYPES, TEACHER_TIERS, TEACHER_RATES } = require('../config/plans');
const { CREDENTIAL_KINDS } = require('../models/TeacherApplication');

/** Public: the tech skills members can learn or teach, and the vocabulary of teacher verification. */
exports.getCatalog = (req, res) => {
  res.json({
    categories: CATEGORIES,
    teacherTypes: TEACHER_TYPES,
    teacherTiers: TEACHER_TIERS,
    credentialKinds: CREDENTIAL_KINDS,
    rates: { min: TEACHER_RATES.min, step: TEACHER_RATES.step, default: TEACHER_RATES.default, caps: TEACHER_RATES.caps }
  });
};
