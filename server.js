// server.js
import express from "express";
import { google } from "googleapis";
import bodyParser from "body-parser";

// === Konfigurasi Google Sheets API ===
const SPREADSHEET_ID = "1GTyEhbvsYWMk53va8SLAFcTRA4PbSBSuuzXLoT7JooA"; // ganti sesuai ID sheet kamu
const SHEET_NAME = "spinmerdeka";

// Load kredensial dari file .env atau JSON service account
import fs from "fs";
const auth = new google.auth.GoogleAuth({
  keyFile: "service_account.json", // file JSON dari Google Cloud
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const app = express();
app.use(bodyParser.json());

// === Ambil Kode Hari Ini ===
app.get("/ambilKodeHariIni", async (req, res) => {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!O2:O`,
    });
    const data = (result.data.values || []).flat().filter(Boolean);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Cek dan Pakai Token ===
app.post("/cekDanPakaiToken", async (req, res) => {
  const { nama, kode } = req.body;
  try {
    const range = `${SHEET_NAME}!O2:R`;
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const data = result.data.values || [];
    let found = false;

    for (let i = 0; i < data.length; i++) {
      const [kuponA, statusA, kuponB, statusB] = data[i];

      if (kode === kuponA) {
        if ((statusA || "").toLowerCase() === "sudah") {
          return res.json({ message: `❌ Kupon ${kode} sudah dipakai!` });
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!P${i + 2}`,
          valueInputOption: "RAW",
          requestBody: { values: [["sudah"]] },
        });
        found = true;
        break;
      }

      if (kode === kuponB) {
        if ((statusB || "").toLowerCase() === "sudah") {
          return res.json({ message: `❌ Kupon ${kode} sudah dipakai!` });
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!R${i + 2}`,
          valueInputOption: "RAW",
          requestBody: { values: [["sudah"]] },
        });
        found = true;
        break;
      }
    }

    if (!found) return res.json({ message: "❌ KODE TIDAK VALID atau SUDAH DIPAKAI!" });
    res.json({ message: "OK" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Simpan Hasil ===
app.post("/simpanHasil", async (req, res) => {
  const { nama, status, kode } = req.body;
  try {
    const now = new Date();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[now.toISOString(), nama.toLowerCase(), status, kode]],
      },
    });
    res.json({ message: "Data tersimpan" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
