// server.js
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();

// --- Config
const ALLOWED = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// --- Middlewares
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED.includes("*") || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  }
}));
app.use(express.json()); // ganti body-parser

// Tangkap error JSON (biar ga 500 kalau body invalid)
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ status: "ERROR", msg: "Invalid JSON" });
  }
  next(err);
});

// --- Google Sheets Auth (Service Account)
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  ["https://script.google.com/macros/s/AKfycbx9-kv79wzrV4ZFWpODh1YXqnkpkiUt0qoNI61WbUSN-wxYFRjlEl-imsGp2v9krHhKsg/exec"]
);
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.SHEET_ID;

// --- Helpers
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

// --- Healthcheck (biar gampang cek URL Railway)
app.get("/", (_req, res) => res.send("Spin API OK"));

// === API: cek token ===
app.post("/cekDanPakaiToken", async (req, res) => {
  try {
    const { nama, kode } = req.body || {};
    if (!nama || !kode) return res.json({ status: "ERROR", msg: "❌ Isi nama & kode!" });

    const rows = await getValues("spindata!O2:P"); // O=kode, P=status
    let foundRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const [kodeKupon, status] = rows[i] || [];
      if (kodeKupon === kode) {
        foundRowIndex = i + 2; // baris sheet (mulai dari 2)
        if (status === "SUDAH") {
          return res.json({ status: "ERROR", msg: "❌ KODE SUDAH DIPAKAI" });
        }
        break;
      }
    }

    if (foundRowIndex === -1) {
      return res.json({ status: "ERROR", msg: "❌ KODE TIDAK VALID!" });
    }

    await updateCell(`spindata!P${foundRowIndex}`, "SUDAH");
    res.json({ status: "OK" });
  } catch (e) {
    console.error("cekDanPakaiToken error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API: simpan hasil spin ===
app.post("/simpanHasil", async (req, res) => {
  try {
    const { nama, kode, status } = req.body || {};
    if (!nama || !kode || !status) {
      return res.json({ status: "ERROR", msg: "Data kurang" });
    }
    await appendRow("spindata!A:D", [
      new Date().toISOString(),
      String(nama).toLowerCase(),
      status,
      kode
    ]);
    res.json({ status: "OK" });
  } catch (e) {
    console.error("simpanHasil error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API: histori gabungan ===
app.get("/ambilHistoriGabungan/:nama", async (req, res) => {
  try {
    const nama = (req.params.nama || "").toLowerCase();
    const rows = await getValues("spindata!A:T");

    const member = rows
      .filter((row, i) => i > 0 && (row[1] || "").toLowerCase() === nama)
      .map(row => ({ nama: row[1], status: row[2] }));

    const fake = rows
      .map(row => {
        const namaFake = row[18]; // S
        const hadiahRaw = row[19]; // T
        const hadiah = parseInt(String(hadiahRaw || "").replace(/[^\d]/g, ""));
        if (!namaFake || isNaN(hadiah)) return null;
        return `${namaFake} Memenangkan Rp ${hadiah.toLocaleString("id-ID")}`;
      })
      .filter(Boolean)
      .slice(0, 10);

    res.json({ member, fake });
  } catch (e) {
    console.error("ambilHistoriGabungan error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// === API: list hadiah lainnya (9 item) ===
app.get("/getSisaHadiah", async (_req, res) => {
  try {
    const data = await getValues("spindata!AE2:AE10");
    res.json((data.flat() || []).map(v => Number(v) || 0));
  } catch (e) {
    console.error("getSisaHadiah error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server error" });
  }
});

// --- Warm-up auth (optional, biar ketahuan kalo cred salah)
(async () => {
  try {
    await auth.authorize();
    console.log("✅ Google auth OK");
  } catch (e) {
    console.error("❌ Google auth FAILED:", e.message);
  }
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready on port ${PORT}`));
