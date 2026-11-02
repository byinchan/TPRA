// Checks data/v1-vendor.json against the original v1 files in /v1.
// No dependencies: a minimal zip reader (central directory + inflateRaw) is enough for .xlsx/.docx.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("data/v1-vendor.json", root), "utf8"));
// The verbatim checks cover the 15 original v1 rows only; IRA-16 was added after v1.
const v1Ira = data.ira.filter((r) => !r.addedAfterV1);

function readZipEntry(path, name) {
  const buf = readFileSync(new URL(path, root));
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const raw = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not found in ${path}`);
}

const unescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

test("row counts and stable IDs", () => {
  assert.equal(v1Ira.length, 15);
  assert.equal(data.ira.length, 16);
  assert.equal(data.ddq.length, 26);
  data.ira.forEach((r, i) => assert.equal(r.id, `IRA-${String(i + 1).padStart(2, "0")}`));
  data.ddq.forEach((r, i) => assert.equal(r.id, `DDQ-${String(i + 1).padStart(2, "0")}`));
});

test("IRA-16 is the only post-v1 row and is marked as such", () => {
  const added = data.ira.filter((r) => r.addedAfterV1);
  assert.deepEqual(added.map((r) => r.id), ["IRA-16"]);
  const [r] = added;
  assert.equal(r.question, "Will employee or other personal information be shared?");
  assert.equal(r.area, "Data");
  assert.equal(r.answer, "No");
  assert.equal(r.v1Rating, null);
  assert.match(r.note, /^Added after v1, not in the manual assessment\./);
});

test("IRA: 5 areas x 3 questions in v1, allowed values only", () => {
  const areas = ["Data", "System Access", "Service Criticality", "Technology", "Regulatory"];
  v1Ira.forEach((r, i) => {
    assert.equal(r.area, areas[Math.floor(i / 3)]);
    assert.ok(["Yes", "No", "Unknown"].includes(r.answer), r.id);
    assert.ok(["Low", "Medium", "High"].includes(r.v1Rating), r.id);
  });
  assert.equal(data.v1Labels.overallInherentRisk, "Medium");
});

test("DDQ: 8 domains with the v1 question counts", () => {
  const counts = {};
  for (const r of data.ddq) counts[r.domain] = (counts[r.domain] ?? 0) + 1;
  assert.deepEqual(counts, {
    "Information Security Governance": 4,
    "Identity & Access Management": 3,
    "Data Protection": 4,
    "Incident Response": 3,
    "Business Continuity": 2,
    "Compliance & Assurance": 3,
    "Third-Party Management": 4,
    "AI Governance": 3,
  });
});

test("IRA wording matches the v1 workbook exactly", () => {
  const file = data.source.files.ira;
  const strings = [...readZipEntry(file, "xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
    unescape([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const sheet = readZipEntry(file, "xl/worksheets/sheet1.xml");
  const cell = (ref) => {
    const m = sheet.match(new RegExp(`<c r="${ref}"([^>]*)>.*?<v>([^<]*)</v>`, "s"));
    return m[1].includes('t="s"') ? strings[Number(m[2])] : m[2];
  };
  assert.equal(cell("B1"), data.vendor);
  assert.equal(cell("B2"), data.service);
  assert.equal(cell("B4"), data.v1Labels.overallInherentRisk);
  v1Ira.forEach((r, i) => {
    const row = 11 + i;
    assert.deepEqual(
      [cell(`A${row}`), cell(`B${row}`), cell(`C${row}`), cell(`D${row}`)],
      [r.area, r.question, r.answer, r.v1Rating],
      r.id,
    );
  });
});

test("DDQ wording matches the v1 questionnaire exactly", () => {
  const xml = readZipEntry(data.source.files.ddq, "word/document.xml");
  const text = (x) => unescape([...x.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""));
  const rows = [];
  for (const tr of xml.matchAll(/<w:tr[ >].*?<\/w:tr>/gs)) {
    const cells = [...tr[0].matchAll(/<w:tc>.*?<\/w:tc>/gs)].map((tc) =>
      [...tc[0].matchAll(/<w:p[ >].*?<\/w:p>/gs)].map((p) => text(p[0])).filter(Boolean).join(" "),
    );
    if (cells[0] !== "Question") rows.push(cells);
  }
  assert.deepEqual(rows, data.ddq.map((r) => [r.question, r.response]));
});
