/** Credits are decimal hours; keep them exact to two places. */
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

module.exports = { round2 };
