import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPromptText, selectSkills, injectSkills } from "open-sse/rtk/skillInject.js";

let dir;

const writeSkill = (name, description, body) => {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(
    path.join(dir, name, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`
  );
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
  writeSkill("postgres-patterns", "Postgres schema design, indexes and slow query optimization", "PG BODY");
  writeSkill("react-testing", "React component testing with testing library and vitest", "REACT BODY");
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("skill auto-select", () => {
  it("extracts only user text across formats", () => {
    expect(extractPromptText({ messages: [{ role: "system", content: "ignored" }, { role: "user", content: "hello world" }] })).toContain("hello world");
    expect(extractPromptText({ messages: [{ role: "system", content: "ignored" }] })).not.toContain("ignored");
    expect(extractPromptText({ contents: [{ role: "user", parts: [{ text: "gemini shape" }] }] })).toContain("gemini shape");
  });

  it("picks the on-topic skill and injects its body", () => {
    const body = { messages: [{ role: "user", content: "my postgres query is slow, need better indexes for this schema" }] };
    const picked = injectSkills(body, "openai", { dir });
    expect(picked).toEqual(["postgres-patterns"]);
    expect(JSON.stringify(body)).toContain("PG BODY");
    expect(JSON.stringify(body)).not.toContain("REACT BODY");
  });

  it("injects nothing when the prompt matches no skill", () => {
    const body = { messages: [{ role: "user", content: "halo" }] };
    expect(injectSkills(body, "openai", { dir })).toBeNull();
  });

  it("fails open on an unreadable directory", () => {
    const body = { messages: [{ role: "user", content: "postgres indexes schema" }] };
    expect(injectSkills(body, "openai", { dir: path.join(dir, "nope") })).toBeNull();
    expect(body.messages).toHaveLength(1);
  });

  it("requires more than one keyword hit", () => {
    const skills = [{ name: "x", description: "", tokens: new Set(["postgres", "indexes"]), body: "b" }];
    expect(selectSkills("postgres", skills)).toEqual([]);
    expect(selectSkills("postgres indexes", skills)).toHaveLength(1);
  });
});
