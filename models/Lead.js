const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
}, { timestamps: true });

const followUpSchema = new mongoose.Schema({
  dueDate: { type: Date, required: true },
  type: { type: String, enum: ['Call', 'Email', 'Meeting'], required: true },
  note: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: true });

const leadSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  company: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  source: { type: String, trim: true, default: '' },
  industry: { type: String, trim: true, default: '' },
  estimatedDealValue: { type: Number, min: 0, default: 0 },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  owner: { type: String, trim: true, default: '' },
  stage: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
    default: 'New',
  },
  notes: { type: [noteSchema], default: [] },
  followUps: { type: [followUpSchema], default: [] },
  activityTimeline: { type: [activitySchema], default: [] },
}, { timestamps: true });

leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ stage: 1, priority: 1, source: 1, owner: 1 });

module.exports = mongoose.model('Lead', leadSchema);
