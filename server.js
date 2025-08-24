// server.js — proxy ke Google Apps Script Web App
const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args)); // ⬅️ tambahkan ini

const app = express();

// ==== KONFIGURASI ====
const GAS_URL =
  process.env.GAS_URL ||
  "https://script.google.com/macros/s/AKfycbx9-kv79wzrV4ZFWpODh1YXqnkpkiUt0qoNI61WbUSN-wxYFRjlEl-imsGp2v9krHhKsg/exec";

// izinkan GitHub Pages kamu (bisa sementara '*' saat testing)
const ALLOWED = (process.env.ALLOWED_ORIGIN || "https://klikblg.github.io")
  .split(",")
  .map(s => s.trim());

// ==== MIDDLEWARES ====
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED.includes("*") || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  }
}));
app.use(express.json());

// tangkap JSON invalid
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ status: "ERROR", msg: "Invalid JSON" });
  }
  next(err);
});

// ==== HEALTHCHECK ====
app.get("/", (_req, res) => res.send("Spin API Proxy OK"));

// ==== ENDPOINTS (proxy ke Apps Script) ====
// Catatan: di GAS kamu sebaiknya handle 'action' di doGet/doPost.
// - cekDanPakaiToken  : POST {nama,kode}
// - simpanHasil       : POST {nama,kode,status}
// - getSisaHadiah     : GET
// - ambilHistori...   : GET ?nama=...

// 1) Cek & pakai token (sekali pakai)
app.post("/cekDanPakaiToken", async (req, res) => {
  try {
    const { nama, kode } = req.body || {};
    if (!nama || !kode) return res.json({ status: "ERROR", msg: "❌ Isi nama & kode!" });

    const r = await fetch(`${GAS_URL}?action=cekDanPakaiToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, kode })
    });

    const text = await r.text();
    // Apps Script bisa return "OK" (string) atau JSON.
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    // Normalisasi ke {status:"OK"} / {status:"ERROR", msg:"..."}
    if (typeof data === "string") {
      if (data === "OK") return res.json({ status: "OK" });
      return res.json({ status: "ERROR", msg: data });
    }
    return res.json(data);
  } catch (e) {
    console.error("cekDanPakaiToken proxy error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server proxy error" });
  }
});

// 2) Simpan hasil spin
app.post("/simpanHasil", async (req, res) => {
  try {
    const { nama, kode, status } = req.body || {};
    if (!nama || !kode || !status) {
      return res.json({ status: "ERROR", msg: "Data kurang" });
    }

    const r = await fetch(`${GAS_URL}?action=simpanHasil`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, kode, status })
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (typeof data === "string") {
      if (data === "OK") return res.json({ status: "OK" });
      return res.json({ status: "ERROR", msg: data });
    }
    return res.json(data);
  } catch (e) {
    console.error("simpanHasil proxy error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server proxy error" });
  }
});

// 3) Ambil histori gabungan
app.get("/ambilHistoriGabungan", async (req, res) => {
  try {
    const nama = (req.query.nama || "").trim();
    const r = await fetch(`${GAS_URL}?action=ambilHistoriGabungan&nama=${encodeURIComponent(nama)}`);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { status: "ERROR", msg: text } }
    return res.json(data);
  } catch (e) {
    console.error("ambilHistoriGabungan proxy error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server proxy error" });
  }
});

// 4) Ambil 9 hadiah lainnya
app.get("/getSisaHadiah", async (_req, res) => {
  try {
    const r = await fetch(`${GAS_URL}?action=getSisaHadiah`);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text }
    return res.json(data);
  } catch (e) {
    console.error("getSisaHadiah proxy error:", e);
    res.status(500).json({ status: "ERROR", msg: "Server proxy error" });
  }
});

// === Start (lokal / vercel dev) ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API proxy ready on :${PORT}`));
