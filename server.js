// server.js — Proxy ke Google Apps Script
const express = require("express");
const cors = require("cors");
// fetch utk Node <18
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

const app = express();

// ====== ENV ======
const GAS_URL = process.env.GAS_URL || "https://script.google.com/macros/s/AKfycbx9-kv79wzrV4ZFWpODh1YXqnkpkiUt0qoNI61WbUSN-wxYFRjlEl-imsGp2v9krHhKsg/exec";
const ALLOWED = (process.env.ALLOWED_ORIGIN || "https://klikblg.github.io").split(",").map(s=>s.trim());

// ====== MIDDLEWARE ======
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED.includes("*") || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  }
}));
app.use(express.json());

// ====== HEALTH ======
app.get("/", (_req,res)=>res.send("Spin API Proxy OK"));

// ====== ENDPOINTS ======
app.get("/getSisaHadiah", async (_req,res)=>{
  try{
    const r = await fetch(`${GAS_URL}?action=getSisaHadiah`);
    const t = await r.text();
    let d; try{ d=JSON.parse(t);}catch{ d=t; }
    res.json(d);
  }catch(e){ console.error("getSisaHadiah err:",e); res.status(500).json({status:"ERROR",msg:"Server proxy error"}); }
});

app.get("/ambilHistoriGabungan", async (req,res)=>{
  try{
    const nama = (req.query.nama||"").trim();
    const r = await fetch(`${GAS_URL}?action=ambilHistoriGabungan&nama=${encodeURIComponent(nama)}`);
    const t = await r.text();
    let d; try{ d=JSON.parse(t);}catch{ d={status:"ERROR",msg:t}; }
    res.json(d);
  }catch(e){ console.error("ambilHistori err:",e); res.status(500).json({status:"ERROR",msg:"Server proxy error"}); }
});

app.post("/cekDanPakaiToken", async (req,res)=>{
  try{
    const { nama, kode } = req.body||{};
    if(!nama || !kode) return res.json({status:"ERROR",msg:"❌ Isi nama & kode!"});
    const r = await fetch(`${GAS_URL}?action=cekDanPakaiToken`, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({nama, kode})
    });
    const t = await r.text();
    console.log("GAS /cekDanPakaiToken ->", r.status, t);
    let d; try{ d=JSON.parse(t);}catch{ d=t; }
    if (typeof d === "string") return res.json(d==="OK" ? {status:"OK"} : {status:"ERROR",msg:d});
    res.json(d);
  }catch(e){ console.error("cekDanPakaiToken err:",e); res.status(500).json({status:"ERROR",msg:"Server proxy error"}); }
});

app.post("/simpanHasil", async (req,res)=>{
  try{
    const { nama, kode, status } = req.body||{};
    if(!nama || !kode || !status) return res.json({status:"ERROR",msg:"Data kurang"});
    const r = await fetch(`${GAS_URL}?action=simpanHasil`, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({nama, kode, status})
    });
    const t = await r.text();
    console.log("GAS /simpanHasil ->", r.status, t);
    let d; try{ d=JSON.parse(t);}catch{ d=t; }
    if (typeof d === "string") return res.json(d==="OK" ? {status:"OK"} : {status:"ERROR",msg:d});
    res.json(d);
  }catch(e){ console.error("simpanHasil err:",e); res.status(500).json({status:"ERROR",msg:"Server proxy error"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API proxy ready on :${PORT}`));
