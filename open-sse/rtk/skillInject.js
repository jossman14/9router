// Skill auto-select: scans a skills directory (Claude-Code layout: <dir>/<skill>/SKILL.md),
// scores each skill's frontmatter name+description against the incoming prompt, and injects
// the matching SKILL.md bodies into the system prompt before dispatch.
// Fail-open: any error leaves the body untouched.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { injectSystemPrompt } from "./systemInject.js";

const DEFAULT_DIR = path.join(os.homedir(), ".claude", "skills");
const INDEX_TTL_MS = 60_000;
const MAX_SKILL_CHARS = 20_000;
const STOPWORDS = new Set([
  "when", "with", "this", "that", "from", "into", "your", "their", "them", "have", "will",
  "using", "used", "user", "uses", "skill", "code", "file", "files", "make", "need", "want",
  "should", "would", "about", "before", "after", "over", "than", "then", "each", "only",
  "untuk", "yang", "dengan", "agar", "saat", "juga", "dari", "atau", "pada", "buat", "bisa",
]);

let cache = { at: 0, dir: null, skills: [] };

const tokenize = (text) =>
  new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );

function parseSkill(file) {
  const raw = fs.readFileSync(file, "utf8");
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const description = fm[1].match(/^description:\s*([\s\S]*?)(?:\n[a-z-]+:|$)/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!name) return null;
  return { name, description: description || "", body: raw.slice(0, MAX_SKILL_CHARS), tokens: tokenize(`${name} ${description}`) };
}

function loadIndex(dir) {
  if (cache.dir === dir && Date.now() - cache.at < INDEX_TTL_MS) return cache.skills;
  const skills = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, "SKILL.md");
    try {
      const skill = parseSkill(file);
      if (skill) skills.push(skill);
    } catch { /* a skill that won't parse is simply not selectable */ }
  }
  cache = { at: Date.now(), dir, skills };
  return skills;
}

// Pull user-authored text out of any request format (OpenAI messages, Claude content blocks,
// Gemini contents) without caring which one it is.
export function extractPromptText(body, maxChars = 4000) {
  const parts = [];
  const walk = (node, depth) => {
    if (!node || depth > 6 || parts.length > 200) return;
    if (typeof node === "string") { parts.push(node); return; }
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    if (typeof node !== "object") return;
    if (node.role && node.role !== "user") return;
    walk(node.content ?? node.parts ?? node.text, depth + 1);
  };
  walk(body?.messages ?? body?.contents ?? body?.input, 0);
  const text = parts.join(" ");
  return text.length > maxChars ? text.slice(-maxChars) : text;
}

export function selectSkills(promptText, skills, { limit = 2, minHits = 2 } = {}) {
  const promptTokens = tokenize(promptText);
  if (!promptTokens.size) return [];
  return skills
    .map((skill) => {
      let hits = 0;
      for (const t of skill.tokens) if (promptTokens.has(t)) hits += 1;
      // Normalize so a long description can't outrank a tight, on-topic one.
      return { skill, hits, score: hits / Math.sqrt(skill.tokens.size || 1) };
    })
    .filter((m) => m.hits >= minHits)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.skill);
}

export function injectSkills(body, format, { dir = process.env.SKILLS_DIR || DEFAULT_DIR, limit = 2 } = {}) {
  try {
    const skills = loadIndex(dir);
    if (!skills.length) return null;
    const matched = selectSkills(extractPromptText(body), skills, { limit });
    if (!matched.length) return null;
    const prompt = matched.map((s) => `# Skill: ${s.name}\n\n${s.body}`).join("\n\n---\n\n");
    injectSystemPrompt(body, format, prompt);
    return matched.map((s) => s.name);
  } catch {
    return null;
  }
}
