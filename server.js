// server.js
// Express server version of your Google Apps Script code.gs
// Requires: npm install express googleapis body-parser

const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// === Google Sheets Setup ===
const SHEET_ID = '1GTyEhbvsYWMk53va8SLAFcTRA4PbSBSuuzXLoT7JooA';
const SHEET_NAME = 'spinmerdeka';

// TODO: Replace with your credentials file path
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Load client secrets from a local file.
const fs = require('fs');
let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
} catch (err) {
  console.error('Error loading credentials.json:', err);
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: SCOPES,
});
const sheets = google.sheets({ version: 'v4', auth });

// === Helper Functions ===
async function getSheetRange(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${range}`,
  });
  return res.data.values || [];
}

async function setSheetValue(row, col, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${col}${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}

// === API Endpoints ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint untuk ambil kode hari ini dari Apps Script Web App
app.get('/ambilKodeHariIni', async (req, res) => {
  try {
    const response = await axios.get('https://script.google.com/macros/s/AKfycbxprHOkKMykjNYBqHcyCqmTdMg1_kZjOPKB7vX-cQt2gF7FUgnRi8ytX2Ap9hIkuK8Mfg/exec', {
      params: { action: 'ambilKodeHariIni' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get('/api', async (req, res) => {
  const action = req.query.action;
  const data = req.query;
  let result;
  try {
    switch (action) {
      case 'cekToken':
        result = await cekDanPakaiToken(data.nama, data.kode);
        break;
      case 'simpanHasil':
        result = await simpanHasil(data);
        break;
      // Add other cases as needed
      default:
        result = { error: 'Action tidak dikenal: ' + action };
    }
    res.json(result);
  } catch (error) {
    res.json({ error: error.toString() });
  }
});

app.post('/api', async (req, res) => {
  const action = req.body.action;
  const data = req.body;
  let result;
  try {
    switch (action) {
      case 'cekToken':
        result = await cekDanPakaiToken(data.nama, data.kode);
        break;
      case 'simpanHasil':
        result = await simpanHasil(data);
        break;
      // Add other cases as needed
      default:
        result = { error: 'Action tidak dikenal: ' + action };
    }
    res.json(result);
  } catch (error) {
    res.json({ error: error.toString() });
  }
});

// === Function Implementations ===
async function ambilKodeHariIni() {
  const data = await getSheetRange('O2:O');
  return data.flat().filter(Boolean);
}

async function cekDanPakaiToken(nama, kode) {
  const data = await getSheetRange('O2:R');
  for (let i = 0; i < data.length; i++) {
    const [kuponA, statusA, kuponB, statusB] = data[i];
    if (kode === kuponA) {
      if ((statusA || '').toLowerCase() === 'sudah') return `❌ Kupon ${kode} sudah dipakai!`;
      await setSheetValue(i + 2, 'P', 'sudah');
      return 'OK';
    }
    if (kode === kuponB) {
      if ((statusB || '').toLowerCase() === 'sudah') return `❌ Kupon ${kode} sudah dipakai!`;
      await setSheetValue(i + 2, 'R', 'sudah');
      return 'OK';
    }
  }
  return '❌ KODE TIDAK VALID atau SUDAH DIPAKAI!';
}

async function simpanHasil(data) {
  const values = await getSheetRange('A2:A');
  let rowToWrite = 2;
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) {
      rowToWrite = i + 2;
      break;
    }
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowToWrite}:D${rowToWrite}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        new Date().toISOString(),
        (data.nama || '').toLowerCase(),
        data.status,
        data.kode
      ]],
    },
  });
  return { success: true };
}

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// === Note ===
// - Place your Google API credentials in credentials.json
// - Place your index.html in the same folder for the root page
// - Add more endpoints/functions as needed to match your Apps Script
