// Generates the editable Word glossary from the single source of truth
// (src/app/lib/column-glossary.json) into src/public/Glosario_Columnas_BD_MFL.docx.
//
//   node scripts/build-glossary-docx.mjs
//
// Keep the JSON as the source; regenerate this .docx after editing it.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
  BorderStyle,
  PageOrientation,
} from "docx";

const here = dirname(fileURLToPath(import.meta.url));
const glossary = JSON.parse(readFileSync(join(here, "../app/lib/column-glossary.json"), "utf8"));

const describe = (col) => col.description ?? glossary.generic[col.name] ?? "";
const usage = (col) => (col.auto ? "Automático" : col.required ? "Obligatorio" : "Opcional");

// US Letter content width (12240 - 2*1440 margins = 9360 DXA).
const COLS = [2200, 1500, 1400, 4260]; // Columna | Tipo | Uso | Significado
const TABLE_WIDTH = COLS.reduce((a, b) => a + b, 0);

const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function cell(text, width, { bold = false, header = false, mono = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: bold || header, font: mono ? "Consolas" : undefined, size: 18 })],
      }),
    ],
  });
}

function headerRow() {
  return new TableRow({
    tableHeader: true,
    children: [
      cell("Columna", COLS[0], { header: true }),
      cell("Tipo", COLS[1], { header: true }),
      cell("Uso", COLS[2], { header: true }),
      cell("Significado", COLS[3], { header: true }),
    ],
  });
}

function tableBlock(t) {
  const rows = [headerRow()];
  for (const col of t.columns) {
    rows.push(
      new TableRow({
        children: [
          cell(col.name, COLS[0], { mono: true }),
          cell(col.type, COLS[1]),
          cell(usage(col), COLS[2]),
          cell(describe(col) || "—", COLS[3]),
        ],
      }),
    );
  }
  return new Table({
    columnWidths: COLS,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    rows,
  });
}

const children = [];

// Title block
children.push(
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(glossary.title)] }),
  new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "Alianza Bioversity International - CIAT · Documento vivo para revisión del equipo", italics: true, color: "6B7280", size: 20 }),
    ],
  }),
);

for (const p of glossary.intro) {
  children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: p, size: 20 })] }));
}

children.push(
  new Paragraph({
    spacing: { before: 120, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D1D5DB" } },
    children: [new TextRun({ text: "Convenciones: Obligatorio = debe ir en la plantilla · Opcional = puede omitirse · Automático = lo gestiona el sistema.", italics: true, color: "6B7280", size: 18 })],
  }),
);

for (const mod of glossary.modules) {
  const tables = glossary.tables.filter((t) => t.module === mod.key);
  if (tables.length === 0) continue;
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun(mod.label)] }));
  for (const t of tables) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 40 }, children: [new TextRun(t.label)] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t.description, size: 20 })] }));
    children.push(tableBlock(t));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }
}

const doc = new Document({
  creator: "MFL Soil Platform",
  title: glossary.title,
  styles: {
    default: { document: { run: { font: "Calibri" } } },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    },
  ],
});

const out = join(here, "../public/Glosario_Columnas_BD_MFL.docx");
const buffer = await Packer.toBuffer(doc);
writeFileSync(out, buffer);
console.log("Generado:", out, `(${buffer.length} bytes, ${glossary.tables.length} tablas)`);
