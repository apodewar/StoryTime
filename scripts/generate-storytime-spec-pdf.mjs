import fs from "fs";
import path from "path";
import process from "process";

const ROOT = process.cwd();
const sourcePath = path.join(ROOT, "docs", "storytime-mobile-product-spec.md");
const outputPath = path.join(ROOT, "docs", "storytime-mobile-product-spec.pdf");

const markdown = fs.readFileSync(sourcePath, "utf8");

const contentLines = markdown
  .split(/\r?\n/)
  .map((line) => {
    if (line.startsWith("# ")) return line.replace(/^# /, "").toUpperCase();
    if (line.startsWith("## ")) return line.replace(/^## /, "");
    if (/^\d+\.\s/.test(line)) return line;
    if (line.startsWith("- ")) return `- ${line.slice(2)}`;
    return line;
  })
  .flatMap((line) => wrapLine(line, 92));

const doc = buildSimplePdf(contentLines);
fs.writeFileSync(outputPath, doc);

console.log(`Generated: ${path.relative(ROOT, outputPath)}`);

function wrapLine(line, maxChars) {
  if (line.trim().length === 0) return [""];
  if (line.length <= maxChars) return [line];

  const words = line.split(" ");
  const wrapped = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) wrapped.push(current);
  return wrapped;
}

function buildSimplePdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 50;
  const marginTop = 740;
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((marginTop - 60) / lineHeight);

  const pages = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }

  const objects = [];
  let objId = 1;

  const catalogId = objId++;
  const pagesId = objId++;

  const pageObjectIds = [];
  const contentObjectIds = [];

  for (let i = 0; i < pages.length; i++) {
    pageObjectIds.push(objId++);
    contentObjectIds.push(objId++);
  }

  const fontId = objId++;

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  const pageKids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[pagesId] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageKids}] >>`;

  for (let i = 0; i < pages.length; i++) {
    const pageId = pageObjectIds[i];
    const contentId = contentObjectIds[i];
    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;

    const commands = [];
    commands.push("BT");
    commands.push(`/F1 11 Tf`);
    commands.push(`${marginLeft} ${marginTop} Td`);

    const pageLines = pages[i];
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const escaped = escapePdfString(pageLines[lineIndex]);
      if (lineIndex === 0) {
        commands.push(`(${escaped}) Tj`);
      } else {
        commands.push(`0 -${lineHeight} Td (${escaped}) Tj`);
      }
    }

    commands.push("ET");
    const stream = commands.join("\n");
    const streamBytes = Buffer.byteLength(stream, "utf8");
    objects[contentId] = `<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`;
  }

  objects[fontId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i++) {
    const off = offsets[i] ?? 0;
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function escapePdfString(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
