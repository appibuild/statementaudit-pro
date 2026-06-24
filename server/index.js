require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' })); // PDFs as base64 can be large

// ── Anthropic proxy ──────────────────────────────────────────────────────────
// Receives the exact request body the client would have sent to Anthropic,
// adds the API key and version headers server-side, returns the response.
// The API key never reaches the client.
app.post('/api/extract', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not set on server.' } });
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── Serve React frontend (production) ────────────────────────────────────────
// In dev, Vite runs on its own port and proxies /api to here.
// In production (Render), Express serves the built client/dist directly.
const clientDist = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StatementAudit Pro — server on http://localhost:${PORT}`));
