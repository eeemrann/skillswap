require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/makeAdmin.js user@example.com');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
    if (!user) {
      console.log('No user found with that email.');
    } else {
      console.log(`${user.name} (${user.email}) is now an admin.`);
    }
    await mongoose.disconnect();
  })
  .catch((err) => console.error('Failed:', err.message));