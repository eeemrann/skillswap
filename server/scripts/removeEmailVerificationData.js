require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const EmailJob = require('../models/EmailJob');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const [users, jobs] = await Promise.all([
    User.collection.updateMany({}, {
      $unset: {
        emailVerified: '',
        emailVerificationCodeHash: '',
        emailVerificationExpires: ''
      }
    }),
    EmailJob.deleteMany({ type: 'EMAIL_VERIFICATION' })
  ]);
  console.log(`Removed verification fields from ${users.modifiedCount} users and deleted ${jobs.deletedCount} obsolete email jobs.`);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error('Email verification cleanup failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
