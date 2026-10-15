const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

const router = express.Router();
const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const priorities = ['Low', 'Medium', 'High'];
const followUpTypes = ['Call', 'Email', 'Meeting'];
const leadFields = [
  'fullName', 'company', 'email', 'phone', 'source', 'industry', 'notes',
  'estimatedDealValue', 'priority', 'owner', 'stage',
];

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function validateLead(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }
  if (!partial && !cleanString(body.fullName)) return 'fullName is required.';
  if (body.fullName !== undefined && !cleanString(body.fullName)) return 'fullName cannot be empty.';
  for (const field of ['fullName', 'company', 'email', 'phone', 'source', 'industry', 'owner']) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return `${field} must be a string.`;
    }
  }
  if (body.email !== undefined && body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return 'email must be a valid email address.';
  }
  if (body.notes !== undefined && (!Array.isArray(body.notes) || body.notes.some((note) => (
    (typeof note !== 'string' && (!note || typeof note.text !== 'string'))
      || !(typeof note === 'string' ? note : note.text).trim()
  )))) {
    return 'notes must be an array of note strings or objects with a text field.';
  }
  if (body.estimatedDealValue !== undefined
    && (!Number.isFinite(Number(body.estimatedDealValue)) || Number(body.estimatedDealValue) < 0)) {
    return 'estimatedDealValue must be a non-negative number.';
  }
  if (body.priority !== undefined && !priorities.includes(body.priority)) {
    return 'priority must be Low, Medium, or High.';
  }
  if (body.stage !== undefined && !stages.includes(body.stage)) {
    return `stage must be one of: ${stages.join(', ')}.`;
  }
  return null;
}

function validateId(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'id must be a valid lead ID.' });
    return false;
  }
  return true;
}

function activity(type, description) {
  return { type, description, timestamp: new Date() };
}

async function findDuplicate(email, phone, excludeId) {
  const conditions = [];
  if (email) conditions.push({ email: email.toLowerCase() });
  if (phone) conditions.push({ phone });
  if (!conditions.length) return null;

  const filter = { $or: conditions };
  if (excludeId) filter._id = { $ne: excludeId };
  return Lead.findOne(filter).lean();
}

function duplicateWarning(res, existingLead) {
  return res.status(409).json({
    duplicate: true,
    warning: 'A lead with this email or phone number already exists.',
    existingLead,
  });
}

router.post('/', asyncRoute(async (req, res) => {
  const error = validateLead(req.body);
  if (error) return res.status(400).json({ error });

  const leadData = {};
  for (const field of leadFields) {
    if (req.body[field] !== undefined) leadData[field] = req.body[field];
  }
  leadData.fullName = cleanString(leadData.fullName);
  leadData.email = cleanString(leadData.email || '').toLowerCase();
  leadData.phone = cleanString(leadData.phone || '');
  if (leadData.notes) {
    leadData.notes = leadData.notes.map((note) => ({ text: typeof note === 'string' ? note.trim() : note.text.trim() }));
  }

  const duplicate = await findDuplicate(leadData.email, leadData.phone);
  if (duplicate) return duplicateWarning(res, duplicate);

  const lead = await Lead.create({
    ...leadData,
    activityTimeline: [activity('created', 'Lead created')],
  });
  return res.status(201).json({ duplicate: false, lead });
}));

router.get('/', asyncRoute(async (req, res) => {
  const filter = {};
  for (const field of ['stage', 'priority', 'source', 'owner']) {
    if (typeof req.query[field] === 'string' && req.query[field].trim()) {
      filter[field] = req.query[field].trim();
    }
  }

  let leads = await Lead.find(filter).lean();
  const sort = String(req.query.sort || 'newest');
  if (sort === 'newest') {
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'dealValue') {
    leads.sort((a, b) => b.estimatedDealValue - a.estimatedDealValue);
  } else if (sort === 'nextFollowUp') {
    const nextDate = (lead) => lead.followUps
      .filter((followUp) => !followUp.completed)
      .reduce((earliest, followUp) => {
        const date = new Date(followUp.dueDate).getTime();
        return date < earliest ? date : earliest;
      }, Number.POSITIVE_INFINITY);
    leads.sort((a, b) => nextDate(a) - nextDate(b));
  } else {
    return res.status(400).json({ error: 'sort must be newest, dealValue, or nextFollowUp.' });
  }

  return res.json(leads);
}));

router.put('/:id', asyncRoute(async (req, res) => {
  if (!validateId(req.params.id, res)) return;
  const error = validateLead(req.body, true);
  if (error) return res.status(400).json({ error });

  const existing = await Lead.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lead not found.' });

  const updates = {};
  for (const field of leadFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.fullName !== undefined) updates.fullName = cleanString(updates.fullName);
  if (updates.email !== undefined) updates.email = cleanString(updates.email || '').toLowerCase();
  if (updates.phone !== undefined) updates.phone = cleanString(updates.phone || '');
  if (updates.notes !== undefined) {
    updates.notes = updates.notes.map((note) => ({ text: typeof note === 'string' ? note.trim() : note.text.trim() }));
  }

  const duplicate = await findDuplicate(
    updates.email !== undefined ? updates.email : existing.email,
    updates.phone !== undefined ? updates.phone : existing.phone,
    existing._id,
  );
  if (duplicate) return duplicateWarning(res, duplicate);

  const oldStage = existing.stage;
  Object.assign(existing, updates);
  if (updates.stage && updates.stage !== oldStage) {
    existing.activityTimeline.push(
      activity('stage_changed', `Stage changed from ${oldStage} to ${updates.stage}`),
    );
  } else {
    existing.activityTimeline.push(activity('updated', 'Lead details updated'));
  }

  await existing.save();
  return res.json({ lead: existing });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  if (!validateId(req.params.id, res)) return;
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  return res.json({ message: 'Lead deleted successfully.' });
}));

router.post('/:id/follow-ups', asyncRoute(async (req, res) => {
  if (!validateId(req.params.id, res)) return;
  const { dueDate, type, note } = req.body || {};
  if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'dueDate must be a valid date.' });
  }
  if (!followUpTypes.includes(type)) {
    return res.status(400).json({ error: 'type must be Call, Email, or Meeting.' });
  }
  if (typeof note !== 'string' || !note.trim()) {
    return res.status(400).json({ error: 'note is required.' });
  }

  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  lead.followUps.push({ dueDate: new Date(dueDate), type, note: note.trim() });
  lead.activityTimeline.push(activity('follow_up_added', `${type} follow-up scheduled`));
  await lead.save();
  return res.status(201).json({ lead, followUp: lead.followUps[lead.followUps.length - 1] });
}));

router.post('/:id/notes', asyncRoute(async (req, res) => {
  if (!validateId(req.params.id, res)) return;
  if (typeof req.body?.text !== 'string' || !req.body.text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  lead.notes.push({ text: req.body.text.trim() });
  lead.activityTimeline.push(activity('note_added', 'Note added'));
  await lead.save();
  return res.status(201).json({ lead });
}));

router.patch('/:id/follow-ups/:followUpId', asyncRoute(async (req, res) => {
  if (!validateId(req.params.id, res)) return;
  if (typeof req.body?.completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean.' });
  }

  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  const followUp = lead.followUps.id(req.params.followUpId);
  if (!followUp) return res.status(404).json({ error: 'Follow-up not found.' });

  followUp.completed = req.body.completed;
  lead.activityTimeline.push(activity(
    'follow_up_updated',
    req.body.completed ? 'Follow-up completed' : 'Follow-up reopened',
  ));
  await lead.save();
  return res.json({ lead });
}));

module.exports = router;
