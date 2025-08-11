// server.js — Express API mirror dari code.gs kamu
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== KONFIG (udah diisi ID kamu, bisa override via .env) =====
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || '1GTyEhbvsYWMk53va8SLAFcTRA4PbSBSuuzXLoT7JooA';
const ALT_SHEET_ID = process.env.ALT_SHEET_ID || '1Tv6RLdbDT3a7XG3qdJQBtrSmTvpJ4Furf63K1iGDapo';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;  // dari service account
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.error('❌ Set dulu GOOGLE_CLIENT_EMAIL & GOOGLE_PRIVATE_KEY di .env (service account).');
  process.exit(1);
}

// ===== AUTH GOOGLE =====
const jwt = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: jwt });

// ===== NAMA SHEET & RANGE =====
const MAIN_SHEET = 'spinmerdeka';
const RANGE_KUPON = `${MAIN_SHEET}!O2:R`;     // O:P:Q:R (kuponA,statusA,kuponB,statusB)
const RANGE_HASIL = `${MAIN_SHEET}!A2:D`;     // append hasil (tgl,nama,status,kode)
const RANGE_KODE_HARI_INI = `${MAIN_SHEET}!O2:O`;
const RANGE_SISA_HADIAH = `${MAIN_SHEET}!AE2:AE10`;
const RANGE_ALL_FOR_HISTORY = `${MAIN_SHEET}!A:Z`;

// ====== PROPS pengganti PropertiesService (pakai sheet _PROPS) ======
const PROPS_SHEET = '_PROPS';

async function ensurePropsSheet() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (meta.data.sheets || []).some(s => s.properties?.title === PROPS_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: PROPS_SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${PROPS_SHEET}!A1:B1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['key', 'value']] },
    });
  }
}
async function getProp(key) {
  await ensurePropsSheet();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${PROPS_SHEET}!A2:B`,
  });
  const rows = r.data.values || [];
  const hit = rows.find(x => (x[0] || '') === key);
  return hit ? (hit[1] || '') : null;
}
async function setProp(key, value) {
  await ensurePropsSheet();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${PROPS_SHEET}!A2:B`,
  });
  const rows = r.data.values || [];
  const idx = rows.findIndex(x => (x[0] || '') === key);
  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${PROPS_SHEET}!A${idx + 2}:B${idx + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[key, value]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${PROPS_SHEET}!A:B`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[key, value]] },
    });
  }
}
async function deletePropsByPrefix(prefix) {
  await ensurePropsSheet();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${PROPS_SHEET}!A2:B`,
  });
  const rows = r.data.values || [];
  const kept = rows.filter(x => !(x[0] || '').startsWith(prefix));
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: `${PROPS_SHEET}!A2:B`,
  });
  if (kept.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${PROPS_SHEET}!A2:B${kept.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: kept },
    });
  }
}

// ===== STATIC (kalau mau taruh index.html di folder public)
app.use(express.static(path.join(process.cwd(), 'public')));

// ====== Endpoint mirror dari code.gs ======

// ambilKodeHariIni()
app.get('/api/ambil-kode-hari-ini', async (_req, res) => {
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGE_KODE_HARI_INI,
    });
    res.json((r.data.values || []).flat().filter(Boolean));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal ambil kode' }); }
});

// cekDanPakaiToken(nama,kode)
app.post('/api/cek-dan-pakai-token', async (req, res) => {
  try {
    const { nama, kode } = req.body || {};
    if (!nama || !kode) return res.status(400).json({ error: 'nama & kode wajib' });

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGE_KUPON,
    });
    const rows = r.data.values || [];

    for (let i = 0; i < rows.length; i++) {
      const [kuponA = '', statusA = '', kuponB = '', statusB = ''] = rows[i];
      const rowNum = i + 2;

      if (kode === kuponA) {
        if (String(statusA).toLowerCase() === 'sudah') {
          return res.json({ ok: false, msg: `❌ Kupon ${kode} sudah dipakai!` });
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${MAIN_SHEET}!P${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [['sudah']] },
        });
        await setProp(`token_${kode}`, nama);
        await setProp(`tipe_${String(nama).toLowerCase()}`, 'kuponA');
        return res.json({ ok: true, msg: 'OK' });
      }

      if (kode === kuponB) {
        if (String(statusB).toLowerCase() === 'sudah') {
          return res.json({ ok: false, msg: `❌ Kupon ${kode} sudah dipakai!` });
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${MAIN_SHEET}!R${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [['sudah']] },
        });
        await setProp(`token_${kode}`, nama);
        await setProp(`tipe_${String(nama).toLowerCase()}`, 'kuponB');
        return res.json({ ok: true, msg: 'OK' });
      }
    }
    res.json({ ok: false, msg: '❌ KODE TIDAK VALID atau SUDAH DIPAKAI!' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal cek/pakai token' }); }
});

// simpanHasil({nama,status,kode})
app.post('/api/simpan-hasil', async (req, res) => {
  try {
    const { nama, status, kode } = req.body || {};
    if (!nama || !status) return res.status(400).json({ error: 'nama & status wajib' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE_HASIL,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[new Date().toISOString(), String(nama).toLowerCase(), status, kode || '']] },
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal simpan hasil' }); }
});

// cekIDHariIni(nama) — baca dari ALT_SHEET_ID kol A:B
app.get('/api/cek-id-hari-ini', async (req, res) => {
  try {
    const nama = String(req.query.nama || '').toLowerCase();
    if (!nama) return res.status(400).json({ error: 'nama wajib' });
    if (!ALT_SHEET_ID) return res.status(400).json({ error: 'ALT_SHEET_ID belum diset' });

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: ALT_SHEET_ID, range: `${MAIN_SHEET}!A:B`,
    });
    const rows = r.data.values || [];
    const today = new Date().toDateString();
    let played = false;
    for (let i = 1; i < rows.length; i++) {
      const tgl = rows[i][0] ? new Date(rows[i][0]).toDateString() : '';
      const nm = String(rows[i][1] || '').toLowerCase();
      if (nm === nama && tgl === today) { played = true; break; }
    }
    res.json({ played });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal cek ID' }); }
});

// getClientInfo()
app.get('/api/client-info', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'Unknown';
  res.json({ ip, userAgent: req.headers['user-agent'] || 'Unknown' });
});

// resetTokenHarian()
app.post('/api/reset-token-harian', async (_req, res) => {
  try {
    await deletePropsByPrefix('token_');
    await deletePropsByPrefix('tipe_');
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal reset token' }); }
});

// ambilHistoriGabungan(nama)
app.get('/api/ambil-histori-gabungan', async (req, res) => {
  try {
    const nama = String(req.query.nama || '').toLowerCase();
    if (!nama) return res.status(400).json({ error: 'nama wajib' });

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGE_ALL_FOR_HISTORY,
    });
    const rows = r.data.values || [];

    const member = [];
    for (let i = 1; i < rows.length; i++) {
      const nm = String(rows[i][1] || '').toLowerCase();
      const status = rows[i][2] || '';
      if (nm === nama) member.push({ nama: nm, status });
    }

    const fake = [];
    for (let i = 1; i < rows.length; i++) {
      const namaFake = rows[i][18];         // kol S
      const hadiahRaw = rows[i][19];        // kol T
      const angka = typeof hadiahRaw === 'number'
        ? hadiahRaw
        : parseInt(String(hadiahRaw || '').replace(/[^\d]/g, ''), 10);
      if (namaFake && !Number.isNaN(angka)) {
        fake.push(`${namaFake} Memenangkan Rp ${angka.toLocaleString('id-ID')}`);
      }
    }
    res.json({ member, fake: fake.slice(0, 10) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal ambil histori' }); }
});

// getSisaHadiah()
app.get('/api/sisa-hadiah', async (_req, res) => {
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGE_SISA_HADIAH,
    });
    res.json((r.data.values || []).flat());
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal ambil sisa hadiah' }); }
});

// getTipeKupon(nama)
app.get('/api/tipe-kupon', async (req, res) => {
  try {
    const nama = String(req.query.nama || '').toLowerCase();
    if (!nama) return res.status(400).json({ error: 'nama wajib' });
    const tipe = await getProp(`tipe_${nama}`);
    res.json({ tipe: tipe || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Gagal ambil tipe kupon' }); }
});

// start
app.listen(PORT, () => console.log(`✅ API jalan di http://localhost:${PORT}`));
