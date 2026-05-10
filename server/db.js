import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  avatar: { type: String },
  ip: { type: String }
});

const matchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team1: String,
  team1Full: String,
  team2: String,
  team2Full: String,
  date: String,
  startTime: String,
  status: String,
  winner: String,
  tournament: String,
  venue: { type: String, default: 'TBA' },
  category: { type: String, default: 'ipl' },
  matchType: { type: String, default: 't20' },
  isAbroad: { type: Boolean, default: false }
});

const voteSchema = new mongoose.Schema({
  matchId: { type: String, required: true },
  userId: { type: String, required: true },
  team: { type: String, required: true }
});

// Compound index to ensure one vote per user per match
voteSchema.index({ matchId: 1, userId: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Match = mongoose.model('Match', matchSchema);
export const Vote = mongoose.model('Vote', voteSchema);

export const connectDb = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is missing in environment variables.');
    }
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};
