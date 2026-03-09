import { describe, test, expect } from "bun:test";
import { buildAnalysisPrompt, SYSTEM_PROMPT } from "../src/ai/prompts";

describe("AI Prompts", () => {
  test("SYSTEM_PROMPT contains key instructions", () => {
    expect(SYSTEM_PROMPT).toContain("标题党");
    expect(SYSTEM_PROMPT).toContain("isClickbait");
    expect(SYSTEM_PROMPT).toContain("score");
    expect(SYSTEM_PROMPT).toContain("reason");
    expect(SYSTEM_PROMPT).toContain("0-100");
  });

  test("buildAnalysisPrompt with title", () => {
    const prompt = buildAnalysisPrompt("测试标题");
    expect(prompt).toContain("测试标题");
    expect(prompt).toContain("热搜标题");
  });
});
