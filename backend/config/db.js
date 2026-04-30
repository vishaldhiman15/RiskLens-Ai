const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async (opts = {}) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  if (uri.startsWith('${{')) {
    throw new Error(`MONGODB_URI is set to "${uri}"`);
  }

  const maxRetries = opts.retries ?? 5;
  const retryDelay = opts.retryDelayMs ?? 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await wait(retryDelay);
      } else {
        console.error('Exceeded max MongoDB connection attempts.');
        throw error;
      }
    }
  }
};

module.exports = connectDB;
