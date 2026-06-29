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

// ── Layer 2 AI coding suggestions ────────────────────────────────────────────
// Batch call for unknown payees. Uses claude-haiku (cheapest) — typically < £0.01 per session.
// Suggestions are proposals only; the human ✓ gate in the coding modal must still be clicked.
app.post('/api/suggest-codes', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  }
  const { payees } = req.body;
  if (!Array.isArray(payees) || !payees.length) {
    return res.status(400).json({ error: 'payees array required' });
  }
  const list = payees.slice(0, 100); // cap at 100 lines per batch
  const prompt = `You are a UK accounting assistant. For each bank statement payee below, suggest the most appropriate nominal account code and name from a standard UK chart of accounts. Return ONLY valid JSON — no markdown fences, no explanation.

Format: {"suggestions": {"<normKey>": {"code": "<code>", "name": "<account name>"}}}

Payees (normKey|payee|description):
${list.map(p => `${p.normKey}|${p.payee}|${p.description}`).join('\n')}

Use typical UK nominal codes where possible. Common examples: Sales/Turnover 4000, Other Income 4900, Cost of Goods Sold 5000, Wages & Salaries 7001, Rent 7100, Utilities 7200, Telephone & Internet 7502, Professional Fees 7600, Travel & Subsistence 7400, Office Supplies 7504, Bank Charges 7900, Advertising 7001, Insurance 7301, Subscriptions 7502. Return only the normKey keys exactly as given.`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await upstream.json();
    const text = data?.content?.find(b => b?.type === 'text')?.text || '';
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end <= start) return res.json({ suggestions: {} });
    const parsed = JSON.parse(text.slice(start, end + 1));
    res.json({ suggestions: parsed.suggestions || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Xero token exchange (PKCE) ────────────────────────────────────────────────
// Requires XERO_CLIENT_SECRET env var. No token storage — client holds access token.
app.post('/api/xero-token', async (req, res) => {
  if (!process.env.XERO_CLIENT_SECRET || !process.env.VITE_XERO_CLIENT_ID) {
    return res.status(501).json({ error: 'Xero CoA not configured (XERO_CLIENT_SECRET / VITE_XERO_CLIENT_ID missing)' });
  }
  const { code, codeVerifier, redirectUri } = req.body;
  if (!code || !codeVerifier || !redirectUri) {
    return res.status(400).json({ error: 'code, codeVerifier, redirectUri required' });
  }
  try {
    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    });
    const upstream = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.VITE_XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64'),
      },
      body: params.toString(),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ error: data.error_description || data.error });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── QBO token exchange ────────────────────────────────────────────────────────
// Requires QBO_CLIENT_SECRET env var. No token storage — client holds access token.
app.post('/api/qbo-token', async (req, res) => {
  if (!process.env.QBO_CLIENT_SECRET || !process.env.VITE_QBO_CLIENT_ID) {
    return res.status(501).json({ error: 'QBO CoA not configured (QBO_CLIENT_SECRET / VITE_QBO_CLIENT_ID missing)' });
  }
  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'code and redirectUri required' });
  }
  try {
    const params = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const upstream = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':        'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.VITE_QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString('base64'),
      },
      body: params.toString(),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ error: data.error_description || data.error });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve React frontend ──────────────────────────────────────────────────────
// In dev, Vite runs its own server (dist won't exist) — block is skipped.
// In production (Render), the build step creates client/dist — block activates.
// Using existsSync avoids a NODE_ENV dependency; works without any env var set.
const fs = require('fs');
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StatementAudit Pro — server on http://localhost:${PORT}`));
