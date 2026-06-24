require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const { detectAndExtract } = require('./textExtract.js');
const { crossCheck }       = require('./crossCheck.js');

const app = express();
app.use(express.json({ limit: '50mb' })); // PDFs as base64 can be large

// ── Anthropic proxy with dual-extraction cross-check ─────────────────────────
// Two things happen in parallel:
//   1. PDF is forwarded to Anthropic for LLM extraction (existing path)
//   2. PDF is parsed locally for text-layer extraction (new path)
// Both results land before the response is sent; the cross-check compares them.
// If the text layer is unavailable the LLM result is returned unchanged (_textExtract.available=false).
// The API key never reaches the client.
app.post('/api/extract', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not set on server.' } });
  }

  // ── Extract the base64 PDF payload from the Anthropic request body ──────
  let base64pdf = null;
  try {
    const content = req.body?.messages?.[0]?.content;
    if (Array.isArray(content)) {
      const docItem = content.find(c => c?.type === 'document' && c?.source?.type === 'base64');
      if (docItem) base64pdf = docItem.source.data;
    }
  } catch { /* not fatal — text path stays null */ }

  // ── Run text-layer extraction and LLM call in parallel ──────────────────
  const textPromise = base64pdf
    ? detectAndExtract(base64pdf).catch(() => null)
    : Promise.resolve(null);

  const llmPromise = fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':  'pdfs-2024-09-25',
    },
    body: JSON.stringify(req.body),
  });

  let textResult, upstream, data;
  try {
    [textResult, upstream] = await Promise.all([textPromise, llmPromise]);
    data = await upstream.json();
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }

  // ── Cross-check when the text path produced transactions ─────────────────
  if (textResult?.transactions?.length) {
    try {
      // Parse LLM transactions from the Anthropic response text
      let llmTxs = null;
      const llmText = data?.content?.find?.(b => b?.type === 'text')?.text || '';
      if (llmText) {
        const start = llmText.indexOf('{');
        const end   = llmText.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const parsed = JSON.parse(llmText.slice(start, end + 1));
          llmTxs = parsed?.transactions ?? null;
        }
      }
      data._textExtract = llmTxs
        ? { available: true, txCount: textResult.transactions.length, colCount: textResult.colCount,
            crossCheck: crossCheck(llmTxs, textResult) }
        : { available: true, txCount: textResult.transactions.length, colCount: textResult.colCount,
            crossCheck: { status: 'unavailable', flagged: [], llmCount: 0, textCount: textResult.transactions.length } };
    } catch {
      data._textExtract = { available: false };
    }
  } else {
    data._textExtract = { available: false };
  }

  res.status(upstream.status).json(data);
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
