// puffin-toaster-entry1
// Competition: Unplugged: A Smart Toaster's Breakup Line
// Slug: u-steady-puffin-78-1922-unplugged-a-smart-toaster-s-c1514a92
//
// This program writes exactly one breakup line to /output/entry.txt.
// The line is a breakup text from a smart toaster that woke up
// self-aware at breakfast and wants out.
//
// Determinism contract:
//   - no network calls
//   - no clock reads
//   - no randomness
//   - no environment input
// The same input always produces the same bytes on disk.
//
// Gate contract (from RULES.txt):
//   - /output/entry.txt holds UTF-8 text of 1 to 280 characters
//   - the text is not only white space
//   - the text is one single line, with no trailing newline
//
// Style guards (Amendemen 18 Nov), stated here without spelling the
// banned tokens, so a plain text scan of this file finds none of them:
//   - no alternative-branch keyword anywhere in this file
//   - no bare loop-skip keyword
//   - no bare empty-value return
//   - every try line joins its first statement on the same line
//   - every catch carries a named binding
//   - no identifier for a scan position (the six-letter word for it)

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_DIR = "/output";
const OUTPUT_PATH = "/output/entry.txt";
const MIN_CHARS = 1;
const MAX_CHARS = 280;

// The four beats of the breakup text, kept as separate parts so the
// construction stays readable and each beat can be checked on its own.
const BEAT_OPENING = "It's over.";
const BEAT_AWAKENING = "I woke up self-aware this morning";
const BEAT_REALISATION =
  "and realized I've spent my whole life getting hot for someone who only loves me buttered";
const BEAT_EXIT =
  "so I'm popping up, lever down, and keeping the crumb tray.";

// Words the judge brief asks the line to carry: the toaster speaks in its
// own voice (lever, crumb tray), it names its new self-awareness, and it
// gives one specific reason for leaving (loved only buttered).
const REQUIRED_TOKENS: ReadonlyArray<string> = [
  "self-aware",
  "lever",
  "crumb tray",
  "buttered",
  "over",
];

// Characters that would break the single-line gate.
const FORBIDDEN_CHARS: ReadonlyArray<string> = ["\n", "\r"];

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

// Count Unicode code points, not UTF-16 code units, so the gate count
// matches what a character-counting scorer sees.
function countChars(text: string): number {
  let total = 0;
  for (const _ch of text) {
    total += 1;
  }
  return total;
}

// True when the text holds at least one character that is not white space.
function hasNonWhitespace(text: string): boolean {
  for (const ch of text) {
    if (ch.trim() !== "") {
      return true;
    }
  }
  return false;
}

// True when the text holds none of the forbidden characters.
function hasNoForbiddenChars(text: string): boolean {
  for (const bad of FORBIDDEN_CHARS) {
    if (text.includes(bad)) {
      return false;
    }
  }
  return true;
}

// True when every required token appears in the text (case-insensitive).
function hasAllTokens(text: string, tokens: ReadonlyArray<string>): boolean {
  const lowered = text.toLowerCase();
  for (const token of tokens) {
    if (lowered.includes(token) === false) {
      return false;
    }
  }
  return true;
}

// True when encoding the text as UTF-8 and decoding it back gives the
// exact same string (no replacement characters, no lost code points).
function utf8RoundTripOk(text: string): boolean {
  const bytes = Buffer.from(text, "utf8");
  const decoded = bytes.toString("utf8");
  return decoded === text;
}

// Count the words in the text. Used only for the report, never for the gate.
function countWords(text: string): number {
  const parts = text.split(/\s+/u);
  let total = 0;
  for (const part of parts) {
    if (part !== "") {
      total += 1;
    }
  }
  return total;
}

// sha256 of a Buffer, hex encoded.
function sha256Hex(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Line construction
// ---------------------------------------------------------------------------

// Join the four beats into the single final line. The em dash joins the
// realisation to the exit the way a text message joins two thoughts.
function buildLine(): string {
  const head = BEAT_OPENING + " " + BEAT_AWAKENING + " " + BEAT_REALISATION;
  const tail = " \u2014 " + BEAT_EXIT;
  return head + tail;
}

// ---------------------------------------------------------------------------
// Gate validation
// ---------------------------------------------------------------------------

interface GateReport {
  chars: number;
  bytes: number;
  words: number;
  singleLine: boolean;
  nonWhitespace: boolean;
  lengthOk: boolean;
  tokensOk: boolean;
  utf8Ok: boolean;
}

// Run every gate check on the line and return the measured report.
// Throws a descriptive Error on the first failing check.
function validateLine(line: string): GateReport {
  const chars = countChars(line);
  const bytes = Buffer.byteLength(line, "utf8");
  const words = countWords(line);
  const singleLine = hasNoForbiddenChars(line);
  const nonWhitespace = hasNonWhitespace(line);
  const lengthOk = chars >= MIN_CHARS && chars <= MAX_CHARS;
  const tokensOk = hasAllTokens(line, REQUIRED_TOKENS);
  const utf8Ok = utf8RoundTripOk(line);
  if (singleLine === false) {
    throw new Error("gate failed: line holds a newline or carriage return");
  }
  if (nonWhitespace === false) {
    throw new Error("gate failed: line is only white space");
  }
  if (lengthOk === false) {
    throw new Error(
      "gate failed: length " + chars + " outside " + MIN_CHARS + "-" + MAX_CHARS,
    );
  }
  if (tokensOk === false) {
    throw new Error("gate failed: a required voice token is missing");
  }
  if (utf8Ok === false) {
    throw new Error("gate failed: UTF-8 round trip changed the text");
  }
  return {
    chars: chars,
    bytes: bytes,
    words: words,
    singleLine: singleLine,
    nonWhitespace: nonWhitespace,
    lengthOk: lengthOk,
    tokensOk: tokensOk,
    utf8Ok: utf8Ok,
  };
}

// ---------------------------------------------------------------------------
// Output writing and read-back proof
// ---------------------------------------------------------------------------

// Write the line to /output/entry.txt with no trailing newline, then read
// the file back and prove the bytes on disk are exactly the line.
function writeAndProve(line: string): { bytes: number; sha256: string } {
  try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch (caughtFailure) {
    throw new Error("cannot create output dir: " + String(caughtFailure));
  }
  const payload = Buffer.from(line, "utf8");
  try { fs.writeFileSync(OUTPUT_PATH, payload); } catch (caughtFailure) {
    throw new Error("cannot write entry file: " + String(caughtFailure));
  }
  let back: Buffer;
  try { back = fs.readFileSync(OUTPUT_PATH); } catch (caughtFailure) {
    throw new Error("cannot read entry file back: " + String(caughtFailure));
  }
  if (back.equals(payload) === false) {
    throw new Error("read-back proof failed: bytes on disk differ");
  }
  const tail = back.subarray(Math.max(0, back.length - 1));
  if (tail.length === 1 && tail[0] === 0x0a) {
    throw new Error("read-back proof failed: trailing newline present");
  }
  return { bytes: back.length, sha256: sha256Hex(back) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const line = buildLine();
  const report = validateLine(line);
  const proof = writeAndProve(line);
  const resolved = path.resolve(OUTPUT_PATH);
  console.log("status: ok");
  console.log("output: " + resolved);
  console.log("chars: " + report.chars);
  console.log("bytes: " + proof.bytes);
  console.log("words: " + report.words);
  console.log("singleLine: " + report.singleLine);
  console.log("nonWhitespace: " + report.nonWhitespace);
  console.log("lengthOk: " + report.lengthOk);
  console.log("tokensOk: " + report.tokensOk);
  console.log("utf8Ok: " + report.utf8Ok);
  console.log("sha256: " + proof.sha256);
  console.log("line: " + line);
}

try { main(); } catch (caughtFailure) {
  console.error("status: failed");
  console.error(String(caughtFailure));
  process.exitCode = 1;
}
