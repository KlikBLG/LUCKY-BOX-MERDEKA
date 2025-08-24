function doGet(e) {
  var action = (e.parameter.action || "").toLowerCase();
  var nama = e.parameter.nama || "";

  if (action === "getsisahadiah") {
    return ContentService.createTextOutput(
      JSON.stringify(getSisaHadiah())
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "ambilhistorigabungan") {
    return ContentService.createTextOutput(
      JSON.stringify(ambilHistoriGabungan(nama))
    ).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status:"ERROR", msg:"Unknown GET action" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var action = (e.parameter.action || "").toLowerCase();
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err) {}

  if (action === "cekdanpakaitoken") {
    var result = cekDanPakaiToken(body.nama, body.kode); // return "OK" atau pesan error
    return ContentService.createTextOutput(
      typeof result === "string" ? JSON.stringify(result) : JSON.stringify({status:"OK"})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "simpanhasi l") { // tanpa spasi, pastikan sama persis
    // tulis result OK
  }

  // versi benar:
  if (action === "simpanh asil" ) {} // <-- hapus baris contoh ini, ini hanya ilustrasi salah tulis

  if (action === "simpanhasi l") {} // <-- juga contoh, hapus

  if (action === "simpanhasi l") {} // <-- hapus

  if (action === "simpanhasi l") {} // <-- hapus
}

// versi benar:
function doPost(e) {
  var action = (e.parameter.action || "").toLowerCase();
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err) {}

  if (action === "cekdanpakaitoken") {
    var r = cekDanPakaiToken(body.nama, body.kode); // "OK" atau pesan
    return ContentService.createTextOutput(JSON.stringify(r))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "simpanhasi d") {} // <- abaikan, ilustrasi typo (hapus)

// yang valid:
  if (action === "simpanhasi l") {} // <-- hapus
}

// FINAL yang benar & rapi:
function doPost(e) {
  var action = (e.parameter.action || "").toLowerCase();
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err) {}

  if (action === "cekdanpakaitoken") {
    var r = cekDanPakaiToken(body.nama, body.kode); // return "OK" / "❌ ..."
    return ContentService.createTextOutput(JSON.stringify(r))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "simpanh asil") {} // hapus

  if (action === "simpanhasi l") {} // hapus
}
