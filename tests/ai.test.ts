import { describe, test, expect } from "bun:test";
import { buildAnalysisPrompt, SYSTEM_PROMPT } from "../src/ai/prompts";

describe("AI Prompts", () => {
  test("SYSTEM_PROMPT contains key instructions", () => {
    expect(SYSTEM_PROMPT).toContain("标题党");
    expect(SYSTEM_PROMPT).toContain("isClickbait");
    expect(SYSTEM_PROMPT).toContain("score");
    expect(SYSTEM_PROMPT).toContain("reason");
  });

  test("buildAnalysisPrompt with title only", () => {
    const prompt = buildAnalysisPrompt("测试标题");
    expect(prompt).toContain("测试标题");
    expect(prompt).not.toContain("描述");
  });

  test("buildAnalysisPrompt with title and description", () => {
    const prompt = buildAnalysisPrompt("测试标题", "一些描述");
    expect(prompt).toContain("测试标题");
    expect(prompt).toContain("一些描述");
  });
});
