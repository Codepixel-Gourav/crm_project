require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const leadRoutes = require('./routes/leadRoutes');

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'connecting' });
});

app.use('/api/leads', leadRoutes);

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

async function start() {
  // Hardcoded fallback URI taaki .env ki error dobara na aaye
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://crm_9588:gourav.jv9588@cluster0.la21nql.mongodb.net/leadflow-crm?retryWrites=true&w=majority";

  if (!mongoUri) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`LeadFlow API listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Could not start LeadFlow API:', error);
    process.exitCode = 1;
  });
}

module.exports = app;