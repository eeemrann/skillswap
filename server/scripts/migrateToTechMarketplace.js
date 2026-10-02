/**
 * One-off migration for databases created before SkillSwap became a paid, tech-only marketplace.
 *
 *   node scripts/migrateToTechMarketplace.js            applies the changes
 *   node scripts/migrateToTechMarketplace.js --dry-run  only reports what would change
 *
 * What it does:
 *  - keeps only catalog tech skills in "skills to learn" (other skills are dropped and reported);
 *  - clears "skills offered" for everyone who is not a verified teacher, because teaching now
 *    requires approval (those members can apply on the Teach page);
 *  - fills in the new wallet fields. Existing credit balances stay, but they all count as
 *    learning credits: none of them can be withdrawn, only credits earned from now on can.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');
const { normalizeSkills } = require('../config/catalog');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const report = { users: 0, changed: 0, droppedWanted: new Map(), clearedOffered: 0 };

  for await (const user of User.find({}).cursor()) {
    report.users += 1;
    const update = {};

    const wanted = normalizeSkills(user.skillsWanted);
    if (wanted.length !== (user.skillsWanted || []).length || wanted.some((skill, index) => skill !== user.skillsWanted[index])) {
      (user.skillsWanted || []).filter((skill) => !wanted.includes(skill)).forEach((skill) => report.droppedWanted.set(skill, (report.droppedWanted.get(skill) || 0) + 1));
      update.skillsWanted = wanted;
    }
    if (user.teacherStatus !== 'approved' && (user.skillsOffered || []).length) {
      update.skillsOffered = [];
      report.clearedOffered += 1;
    }
    if (user.teacherStatus === undefined) update.teacherStatus = 'none';
    if (user.earnedCredits === undefined) update.earnedCredits = 0;
    if (user.earnedUsed === undefined) update.earnedUsed = 0;

    if (Object.keys(update).length) {
      report.changed += 1;
      if (!dryRun) await User.collection.updateOne({ _id: user._id }, { $set: update });
    }
  }

  console.log(`${dryRun ? '[dry run] ' : ''}Checked ${report.users} members, ${dryRun ? 'would change' : 'changed'} ${report.changed}.`);
  console.log(`Teaching skills cleared for ${report.clearedOffered} member(s) who are not verified teachers.`);
  if (report.droppedWanted.size) {
    console.log('Skills to learn that are not in the tech catalog (dropped):');
    [...report.droppedWanted.entries()].sort((a, b) => b[1] - a[1]).forEach(([skill, count]) => console.log(`  ${skill}: ${count}`));
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
