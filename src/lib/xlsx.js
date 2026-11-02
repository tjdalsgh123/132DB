// 엑셀(xlsx) 만들기: 시트별 · 열 너비 자동 · 머리줄 고정 · 필터 (외부 라이브러리 없음)
export const XLSX = (() => {
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const zip = (files) => {
    const parts = [], central = []; let off = 0;
    files.forEach(({ name, data }) => {
      const nb = enc.encode(name), db = typeof data === 'string' ? enc.encode(data) : data, crc = crc32(db);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, db.length, true); h.setUint32(22, db.length, true);
      h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, db);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, db.length, true); c.setUint32(24, db.length, true);
      c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + db.length;
    });
    const csize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const textWidth = (s) => Array.from(String(s)).reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);
  // columns: [{name, type: 'text'|'money'|'num'|'pct'}]
  const sheetXml = (cols, rows) => {
    const fmtLen = (v, t) => (v == null || v === '' ? 0 : t === 'money' ? textWidth(Number(v).toLocaleString('en-US')) + 2 : t === 'num' ? textWidth(Number(v).toLocaleString('en-US')) : t === 'pct' ? textWidth((Math.round(v * 1000) / 10) + '%') : textWidth(v));
    const widths = cols.map((c, i) => Math.min(60, Math.max(textWidth(c.name) + 2, ...rows.map((r) => fmtLen(r[i], c.type) + 2), 6)));
    const cell = (ref, v, t, header) => {
      if (header) return '<c r="' + ref + '" s="1" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
      if (v == null || v === '') return '<c r="' + ref + '" s="5"/>';
      if (t === 'money' || t === 'num' || t === 'pct') { const n = Number(v); if (Number.isFinite(n)) return '<c r="' + ref + '" s="' + (t === 'money' ? 2 : t === 'pct' ? 3 : 4) + '"><v>' + n + '</v></c>'; }
      return '<c r="' + ref + '" s="5" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    };
    const all = [cols.map((c) => c.name)].concat(rows);
    const body = all.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => cell(colName(ci) + (ri + 1), v, cols[ci].type, ri === 0)).join('') + '</row>').join('');
    const last = colName(cols.length - 1) + all.length;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<dimension ref="A1:' + last + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="18"/>' +
      '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (w * 1.1 + 1).toFixed(1) + '" customWidth="1"/>').join('') + '</cols>' +
      '<sheetData>' + body + '</sheetData>' +
      '<autoFilter ref="A1:' + last + '"/>' +
      '</worksheet>';
  };
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0&quot;원&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/><family val="2"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/><family val="2"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  // sheets: [{name, cols, rows}]
  const build = (sheets) => {
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => '<sheet name="' + esc(s.name.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      '<definedNames>' + sheets.map((s, i) => '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(s.name.slice(0, 31)) + '\'!$A$1:$' + colName(s.cols.length - 1) + '$' + (s.rows.length + 1) + '</definedName>').join('') + '</definedNames></workbook>';
    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return zip([{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: wbRels }, { name: 'xl/styles.xml', data: STYLES }]
      .concat(sheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.cols, s.rows) }))));
  };
  return { build };
})();
// 파일로 내려받기
export const download = (filename, blob) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
export const T = (k) => ({ name: k, type: 'text' }), Mn = (k) => ({ name: k, type: 'money' }), N = (k) => ({ name: k, type: 'num' }), P = (k) => ({ name: k, type: 'pct' });
