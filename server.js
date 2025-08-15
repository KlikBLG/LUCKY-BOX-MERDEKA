const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
app.use(cors());
app.use(express.json());

// Handler untuk preflight request dari private network (Chrome >= 130)
app.options('/', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Private-Network', 'true');
  res.status(204).send('');
});
app.options('/api', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Private-Network', 'true');
  res.status(204).send('');
});

// Ganti URL di bawah dengan URL Google Apps Script Web App kamu
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxprHOkKMykjNYBqHcyCqmTdMg1_kZjOPKB7vX-cQt2gF7FUgnRi8ytX2Ap9hIkuK8Mfg/exec';

app.get('/api', async (req, res) => {
  try {
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(req.query).toString();
    const response = await fetch(url);
    const data = await response.text();
    res.type('json').send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.text();
    res.type('json').send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Proxy API jalan di http://localhost:3000'));
