// detailedList2Export.js — Excel "Лист2" Layout 1:1 (LIST2 Detailed packing export)
const ExcelJS = require('exceljs');

const EXPORT_SIZES = [98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164];
const COL_FIRST_SIZE = 5; // E
const COL_LAST_SIZE = 16; // P
const COL_Q = 17;
const COL_Z = 26;

function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const LAST_SIZE_LETTER = colLetter(COL_LAST_SIZE);

function sanitizeUnknown(v, fallback = 'UNKNOWN') {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s.length ? s : fallback;
}

/** Parse carton "60*40*40", "60x40x40", "60 × 40 × 40 cm" → cm lengths */
function parseCartonCm(raw) {
  if (!raw || typeof raw !== 'string') return { l: 60, w: 40, h: 40 };
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return { l: 60, w: 40, h: 40 };
  return { l: parseFloat(nums[0]), w: parseFloat(nums[1]), h: parseFloat(nums[2]) };
}

/** Default tare: DB value, else heuristic small vs large carton */
function effectiveTareKg(boxLike) {
  if (boxLike.tare_weight != null && !Number.isNaN(Number(boxLike.tare_weight))) {
    return Math.max(0, Number(boxLike.tare_weight));
  }
  const { l, w, h } = parseCartonCm(boxLike.carton_size || '');
  const maxE = Math.max(l, w, h);
  const vol = l * w * h;
  if (maxE <= 45 && vol < 85000) return 0.3;
  return 1.2;
}

function normalizeSizesSubset(sizes) {
  const out = {};
  EXPORT_SIZES.forEach((sz) => {
    out[String(sz)] = 0;
  });
  if (!sizes || typeof sizes !== 'object') return out;
  for (const [k, raw] of Object.entries(sizes)) {
    const key = String(parseInt(String(k), 10));
    const q = parseInt(String(raw), 10);
    if (Number.isNaN(q) || q <= 0) continue;
    if (!EXPORT_SIZES.includes(Number(key))) continue;
    out[key] = (out[key] || 0) + q;
  }
  return out;
}

function sumSizes(snorm) {
  return EXPORT_SIZES.reduce((s, sz) => s + (snorm[String(sz)] || 0), 0);
}

/** Total pieces inside one mix box — for proportional weight/volume splits */
function mixBoxPieceTotal(box) {
  const items = Array.isArray(box.items) ? box.items : [];
  let t = 0;
  for (const it of items) {
    t += sumSizes(normalizeSizesSubset(it?.sizes || {}));
  }
  return t;
}

/**
 * Normalize a box row from DB JSON or shipment snapshot JSON into flat carton lines (one physical row per box line item).
 */
function flattenBoxesToCartonLines(boxes) {
  const lines = [];
  for (const b of boxes) {
    const zakaz = String(b.zakaz ?? '').trim();
    const specification = sanitizeStr(b.specification, 500);
    const cartonSizeRaw = (b.carton_size && String(b.carton_size).trim()) || '';
    const carton_display = cartonSizeRaw || DEFAULT_CARTON_DISPLAY;
    const grossBase =
      b.gross_weight != null && b.gross_weight !== ''
        ? Number(b.gross_weight)
        : Number(b.kg) || 0;
    const base = {
      zakaz,
      specification,
      carton_size: cartonSizeRaw || DEFAULT_CARTON_DISPLAY,
      carton_display,
      multipack: b.multipack,
      uid: String(b.uid || ''),
      box_num: String(b.box_num ?? b.id ?? ''),
    };

    const tareContainer = {
      tare_weight: b.tare_weight,
      carton_size: carton_display,
    };

    if (String(b.type || 'simple') === 'mix') {
      const items = Array.isArray(b.items) ? b.items : [];
      const totalInBox = mixBoxPieceTotal(b);
      const tareWhole = effectiveTareKg({ ...tareContainer, carton_size: carton_display });
      for (const it of items) {
        const model = sanitizeUnknown(it?.model);
        const color = sanitizeUnknown(it?.color);
        const snorm = normalizeSizesSubset(it?.sizes || {});
        const pieceSum = sumSizes(snorm);
        if (pieceSum <= 0) continue;
        const frac = totalInBox > 0 ? pieceSum / totalInBox : 1;
        const grossKg = grossBase * frac;
        const tareKg = tareWhole * frac;
        lines.push({
          ...base,
          model,
          color,
          sizes: snorm,
          pieceSum,
          numCartons: 1,
          grossKg,
          multipackVal: normalizeMultipack(b.multipack),
          tareKg,
          dims: parseCartonCm(carton_display),
          zPieceNumerator: pieceSum,
          zPieceDenominator: totalInBox || 1,
        });
      }
    } else {
      const model = sanitizeUnknown(b.model);
      const color = sanitizeUnknown(b.color);
      const snorm = normalizeSizesSubset(b.sizes || {});
      if (sumSizes(snorm) <= 0) continue;
      const pieceSum = sumSizes(snorm);
      const grossKg = grossBase;
      const tareKg = effectiveTareKg(tareContainer);
      lines.push({
        ...base,
        model,
        color,
        sizes: snorm,
        pieceSum,
        numCartons: 1,
        grossKg,
        multipackVal: normalizeMultipack(b.multipack),
        tareKg,
        dims: parseCartonCm(carton_display),
        zPieceNumerator: 1,
        zPieceDenominator: 1,
      });
    }
  }
  return lines;
}

const DEFAULT_CARTON_DISPLAY = '60*40*40';

function sanitizeStr(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function normalizeMultipack(mp) {
  if (mp === undefined || mp === null || mp === '') return null;
  const n = parseInt(String(mp), 10);
  if (!Number.isNaN(n) && n >= 0) return n;
  return String(mp);
}

function groupKey(line) {
  return `${String(line.model).trim().toLowerCase()}|${String(line.color).trim().toLowerCase()}`;
}

function groupCartonLinesByModelColor(lines) {
  const map = new Map();
  for (const line of lines) {
    const k = groupKey(line);
    if (!map.has(k)) {
      map.set(k, { model: line.model, color: line.color, lines: [] });
    }
    map.get(k).lines.push(line);
  }
  const groups = [...map.values()];
  groups.forEach((g) => {
    g.lines.sort((a, b) => {
      const z = a.zakaz.localeCompare(b.zakaz, undefined, { numeric: true });
      if (z !== 0) return z;
      return a.box_num.localeCompare(b.box_num, undefined, { numeric: true });
    });
  });
  groups.sort((a, b) => {
    const m = String(a.model).localeCompare(String(b.model));
    if (m !== 0) return m;
    return String(a.color).localeCompare(String(b.color));
  });
  return groups;
}

function mergePairCols(ws, col, startRow) {
  ws.mergeCells(`${col}${startRow}:${col}${startRow + 1}`);
}

function styleHeaderBlock(ws, r1, r2) {
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
  for (const rn of [r1, r2]) {
    const row = ws.getRow(rn);
    row.font = { bold: true, size: 10 };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    for (let c = 1; c <= COL_Z; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
}

function writeTwoRowHeader(ws, startRow) {
  const sr = startRow;
  ['A', 'B', 'C', 'D'].forEach((col) => mergePairCols(ws, col, sr));
  ws.mergeCells(`E${sr}:P${sr}`);
  for (let c = COL_Q; c <= COL_Z; c++) {
    mergePairCols(ws, colLetter(c), sr);
  }

  ws.getCell(`A${sr}`).value = 'Model #';
  ws.getCell(`B${sr}`).value = 'Color';
  ws.getCell(`C${sr}`).value = 'Номер заказа';
  ws.getCell(`D${sr}`).value = 'Спецификации';
  ws.getCell(`E${sr}`).value = 'Размеры';
  ws.getCell(`Q${sr}`).value = 'Pcs per Carton';
  ws.getCell(`R${sr}`).value = 'Num of Cartons';
  ws.getCell(`S${sr}`).value = 'Total pcs';
  ws.getCell(`T${sr}`).value = 'Multipack';
  ws.getCell(`U${sr}`).value = 'Gross Ctn Wt Kgs';
  ws.getCell(`V${sr}`).value = 'Net Ctn Wt Kgs';
  ws.getCell(`W${sr}`).value = 'Total Gross Ctn Wt Kgs';
  ws.getCell(`X${sr}`).value = 'Total Net Ctn Wt Kgs';
  ws.getCell(`Y${sr}`).value = 'Carton Size cm / in';
  ws.getCell(`Z${sr}`).value = 'm3';

  const r2 = ws.getRow(sr + 1);
  for (let i = 0; i < EXPORT_SIZES.length; i++) {
    r2.getCell(COL_FIRST_SIZE + i).value = EXPORT_SIZES[i];
    r2.getCell(COL_FIRST_SIZE + i).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  styleHeaderBlock(ws, sr, sr + 1);
}

function applyRowBorders(ws, rowIndex) {
  const row = ws.getRow(rowIndex);
  for (let c = 1; c <= COL_Z; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
}

function validateExportArithmetic(allDataRows) {
  let totalPieces = 0;
  for (const line of allDataRows) {
    const s = sumSizes(line.sizes);
    if (s !== line.pieceSum) {
      throw new Error('Internal export validation: pieceSum mismatch');
    }
    totalPieces += s;
  }
  return totalPieces;
}

/**
 * Returns Buffer (xlsx). Throws if no data rows.
 */
async function buildDetailedList2Buffer(grouped) {
  const allLines = grouped.flatMap((g) => g.lines);
  if (!allLines.length) {
    const err = new Error('NO_DATA');
    err.code = 'NO_DATA';
    throw err;
  }
  validateExportArithmetic(allLines);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Лист2');

  ws.columns = [
    { width: 16 },
    { width: 16 },
    { width: 13 },
    { width: 13 },
    ...EXPORT_SIZES.map(() => ({ width: 13 })),
    { width: 16 },
    { width: 16 },
    ...Array(8).fill({ width: 13 }),
  ];

  let currentRow = 1;
  const subtotalRows = [];

  const grandFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };

  for (const g of grouped) {
    writeTwoRowHeader(ws, currentRow);
    currentRow += 2;
    const dataStartRow = currentRow;

    for (const line of g.lines) {
      const r = currentRow;
      ws.getRow(r).getCell(1).value = line.model;
      ws.getRow(r).getCell(2).value = line.color;
      ws.getRow(r).getCell(3).value = line.zakaz || '';
      ws.getRow(r).getCell(4).value = line.specification || '';

      EXPORT_SIZES.forEach((sz, i) => {
        const qty = line.sizes[String(sz)] || 0;
        ws.getRow(r).getCell(COL_FIRST_SIZE + i).value = qty > 0 ? qty : null;
      });

      const qFormula = `SUM(E${r}:${LAST_SIZE_LETTER}${r})`;
      ws.getRow(r).getCell(COL_Q).value = { formula: qFormula };

      ws.getRow(r).getCell(COL_Q + 1).value = line.numCartons || 1; // R
      ws.getRow(r).getCell(COL_Q + 2).value = { formula: `R${r}*Q${r}` }; // S

      const tCell = ws.getRow(r).getCell(20);
      if (line.multipackVal != null) tCell.value = line.multipackVal;

      ws.getRow(r).getCell(21).value = line.grossKg; // U
      const tare = Number(line.tareKg.toFixed(3));
      ws.getRow(r).getCell(22).value = { formula: `U${r}-${tare}` }; // V
      ws.getRow(r).getCell(23).value = { formula: `U${r}*R${r}` }; // W
      ws.getRow(r).getCell(24).value = { formula: `V${r}*R${r}` }; // X
      ws.getRow(r).getCell(25).value = line.carton_display; // Y

      const { l, w, h } = line.dims;
      const baseZ = `((${l}/100)+0.01)*((${w}/100)+0.01)*((${h}/100)+0.01)`;
      const zFormula =
        line.zPieceNumerator !== line.zPieceDenominator
          ? `${baseZ}*(${line.zPieceNumerator}/${line.zPieceDenominator})*R${r}`
          : `${baseZ}*R${r}`;
      ws.getRow(r).getCell(26).value = { formula: zFormula };

      const rowObj = ws.getRow(r);
      rowObj.alignment = { vertical: 'middle', horizontal: 'center' };
      for (let c = COL_FIRST_SIZE; c <= COL_LAST_SIZE; c++) {
        rowObj.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      rowObj.font = { size: 10 };

      applyRowBorders(ws, r);
      currentRow++;
    }

    const dataEndRow = currentRow - 1;
    if (dataEndRow < dataStartRow) continue;

    const subR = currentRow;
    ws.mergeCells(`A${subR}:D${subR}`);
    ws.getCell(`A${subR}`).value = 'ИТОГО';
    ws.getCell(`A${subR}`).font = { bold: true, size: 10 };
    ws.getCell(`A${subR}`).alignment = { horizontal: 'center', vertical: 'middle' };

    const sumCols = [COL_Q, COL_Q + 1, COL_Q + 2, 20, 21, 22, 23, 24, 26]; // Q,R,S,T,U,V,W,X,Z
    for (const c of sumCols) {
      const L = colLetter(c);
      ws.getRow(subR).getCell(c).value = { formula: `SUM(${L}${dataStartRow}:${L}${dataEndRow})` };
    }
    // Y: text — leave blank on subtotal (sum only if numeric cells; Excel SUM ignores text)
    ws.getRow(subR).getCell(25).value = { formula: `SUM(Y${dataStartRow}:Y${dataEndRow})` };

    const stRow = ws.getRow(subR);
    stRow.font = { bold: true, size: 10 };
    stRow.alignment = { vertical: 'middle', horizontal: 'center' };
    applyRowBorders(ws, subR);
    subtotalRows.push(subR);
    currentRow++;
  }

  if (!subtotalRows.length) {
    const err = new Error('NO_DATA');
    err.code = 'NO_DATA';
    throw err;
  }

  const gr = currentRow;
  ws.mergeCells(`A${gr}:D${gr}`);
  ws.getCell(`A${gr}`).value = 'ВСЕГО';
  ws.getCell(`A${gr}`).font = { bold: true, size: 11 };
  ws.getCell(`A${gr}`).alignment = { horizontal: 'center', vertical: 'middle' };

  const refs = subtotalRows.map((sr) => (col) => `${col}${sr}`);
  const sumGrand = (colIdx) => {
    const L = colLetter(colIdx);
    const parts = subtotalRows.map((sr) => `${L}${sr}`);
    return { formula: `SUM(${parts.join(',')})` };
  };

  for (const c of [COL_Q, COL_Q + 1, COL_Q + 2, 20, 21, 22, 23, 24, 25, 26]) {
    ws.getRow(gr).getCell(c).value = sumGrand(c);
  }

  const gRow = ws.getRow(gr);
  gRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > COL_Z) return;
    cell.fill = grandFill;
    cell.font = { ...(cell.font || {}), bold: true };
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

module.exports = {
  EXPORT_SIZES,
  flattenBoxesToCartonLines,
  groupCartonLinesByModelColor,
  buildDetailedList2Buffer,
  parseCartonCm,
  effectiveTareKg,
};
