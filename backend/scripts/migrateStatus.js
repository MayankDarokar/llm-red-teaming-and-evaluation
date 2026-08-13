const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Evaluation = require('../models/Evaluation');

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/llm-redteam';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for status migration...');

    const res = await Evaluation.updateMany(
      { status: 'completed' },
      { $set: { status: 'complete' } }
    );

    console.log(`Migrated ${res.modifiedCount} records from 'completed' to 'complete'.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
