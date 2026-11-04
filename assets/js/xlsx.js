/* ============================================================
   xlsx.js: writes a real Excel workbook in the browser
   ------------------------------------------------------------
   An .xlsx is a zip of a few XML files. Nothing here needs compressing,
   so the zip is written in "stored" mode and no library is required.
   ============================================================ */

const enc = new TextEncoder();

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes){
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files){
  const u16 = n => [n & 255, (n >>> 8) & 255];
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const parts = [], central = [];
  let offset = 0;

  for (const [name, text] of Object.entries(files)){
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    // version, UTF-8 flag, stored, time, date (1 Jan 2026: fixed, nothing reads it)
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5c21),
                    ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)];
    const local = Uint8Array.from([0x50, 0x4b, 3, 4, ...common]);
    parts.push(local, nameBytes, data);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...common,
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const size = central.reduce((n, b) => n + b.length, 0);
  const count = Object.keys(files).length;
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(count), ...u16(count),
    ...u32(size), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

const xml = s => String(s ?? "")
  .replace(/[^\u0009\u000A\u000D -퟿-�]/g, "")   // characters XML forbids
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colName(i){
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

/* sheets: [{ name, columns: [{ title, width }], rows: [[...values]] }] */
export function buildWorkbook(sheets){
  const sheetXml = ({ columns, rows }) => {
    const row = (cells, r, style) => `<row r="${r}">` + cells.map((v, c) => {
      const ref = colName(c) + r;
      return typeof v === "number"
        ? `<c r="${ref}" s="${style}"><v>${v}</v></c>`
        : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join("") + `</row>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join("")}</cols>
<sheetData>${row(columns.map(c => c.title), 1, 1)}${rows.map((r, i) => row(r, i + 2, 0)).join("")}</sheetData>
<autoFilter ref="A1:${colName(columns.length - 1)}${rows.length + 1}"/>
</worksheet>`;
  };

  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6D28D9"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return zip(files);
}
