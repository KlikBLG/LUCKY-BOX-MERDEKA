// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
app.use(cors()); // kalau mau aman ganti ke origin GitHub Pages kamu
app.use(bodyParser.json());

// --- Google Sheets Auth (pakai Service Account)
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.SHEET_ID;

// Helper
async function getValues(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range
  });
  return res.data.values || [];
}
async function updateCell(range, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}
async function appendRow(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// === API cek token ===
app.post("/cekDanPakaiToken", async (req, res) => {
  try {
    const { nama, kode } = req.body;
    if (!nama || !kode) return res.json({ status: "ERROR", msg: "❌ Isi nama & kode!" });

    const rows = await getValues("spindata!O2:P");
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const [kodeKupon, status] = rows[i];
      if (kodeKupon === kode) {
        foundRowIndex = i + 2;
        if (status === "SUDAH") {
          return res.json({ status: "ERROR", msg: "❌ KODE SUDAH DIPAKAI" });
        }
        break;
      }
    }
    if (foundRowIndex === -1) return res.json({ status: "ERROR", msg: "❌ KODE TIDAK VALID!" });

    await updateCell(`spindata!P${foundRowIndex}`, "SUDAH");
    res.json({ status: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API simpan hasil spin ===
app.post("/simpanHasil", async (req, res) => {
  try {
    const { nama, kode, status } = req.body;
    await appendRow("spindata!A:D", [
      new Date().toISOString(),
      String(nama).toLowerCase(),
      status,
      kode
    ]);
    res.json({ status: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API ambil histori ===
app.get("/ambilHistoriGabungan/:nama", async (req, res) => {
  try {
    const nama = (req.params.nama || "").toLowerCase();
    const rows = await getValues("spindata!A:T");

    const member = rows
      .filter((row, i) => i > 0 && (row[1] || "").toLowerCase() === nama)
      .map(row => ({ nama: row[1], status: row[2] }));

    const fake = rows
      .map(row => {
        const namaFake = row[18];
        const hadiahRaw = row[19];
        const hadiah = parseInt(String(hadiahRaw || "").replace(/[^\d]/g, ""));
        if (!namaFake || isNaN(hadiah)) return null;
        return `${namaFake} Memenangkan Rp ${hadiah.toLocaleString("id-ID")}`;
      })
      .filter(Boolean)
      .slice(0, 10);

    res.json({ member, fake });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API get sisa hadiah ===
app.get("/getSisaHadiah", async (_req, res) => {
  try {
    const data = await getValues("spindata!AE2:AE10");
    res.json((data.flat() || []).map(v => Number(v) || 0));
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`API ready on port ${process.env.PORT || 3000}`)
);
