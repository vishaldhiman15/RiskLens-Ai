require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

const email = process.argv[2];

if (!email) {
  console.log('Please provide a user email to promote to admin: node seed_admin.js user@example.com');
  process.exit(1);
}

const connectDB = require('./config/db');

async function elevateAdmin() {
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`User with email ${email} not found.`);
    process.exit(1);
  }
  user.role = 'admin';
  await user.save();
  console.log(`Successfully elevated ${email} to admin!`);
  process.exit(0);
}

elevateAdmin();
