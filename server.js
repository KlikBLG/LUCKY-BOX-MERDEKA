const express = require('express');
const cors = require('cors');
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

const APP = 'https://script.google.com/macros/s/AKfycbxprHOkKMykjNYBqHcyCqmTdMg1_kZjOPKB7vX-cQt2gF7FUgnRi8ytX2Ap9hIkuK8Mfg/exec';

const app = express();
app.use(cors());
app.use(express.json());

// preflight
app.options('*', (req,res) => {
  res.set({
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Private-Network':'true'
  });
  res.status(204).end();
});

// satu endpoint serbaguna: GET/POST diterusin ke Apps Script
app.all('/api', async (req, res) => {
  try {
    const url = req.method === 'GET'
      ? `${APP}?${new URLSearchParams(req.query)}`
      : APP;

    const r = await fetch(url, {
      method: req.method,
      headers: {'Content-Type':'application/json'},
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body)
    });

    const text = await r.text();
    res.status(r.status)
       .type(r.headers.get('content-type') || 'text/plain')
       .send(text);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy API: http://localhost:${PORT}`));
