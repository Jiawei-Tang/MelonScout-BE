import { describe, test, expect } from "bun:test";
import {
  SCORE_SYSTEM_PROMPT,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  buildScorePrompt,
  buildDeepAnalysisPrompt,
} from "../src/ai/prompts";

describe("Phase 1: Score Prompts", () => {
  test("SCORE_SYSTEM_PROMPT contains scoring instructions", () => {
    expect(SCORE_SYSTEM_PROMPT).toContain("标题党");
    expect(SCORE_SYSTEM_PROMPT).toContain("isClickbait");
    expect(SCORE_SYSTEM_PROMPT).toContain("score");
    expect(SCORE_SYSTEM_PROMPT).toContain("reason");
    expect(SCORE_SYSTEM_PROMPT).toContain("0-100");
  });

  test("buildScorePrompt includes title", () => {
    const prompt = buildScorePrompt("测试标题");
    expect(prompt).toContain("测试标题");
    expect(prompt).toContain("评分");
  });
});

describe("Phase 2: Deep Analysis Prompts", () => {
  test("DEEP_ANALYSIS_SYSTEM_PROMPT contains investigation instructions", () => {
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("深度搜索");
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("deepAnalysis");
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("verdict");
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("调查");
  });

  test("buildDeepAnalysisPrompt includes title, score, and reason", () => {
    const prompt = buildDeepAnalysisPrompt("可疑标题", 85, "包含夸张用语");
    expect(prompt).toContain("可疑标题");
    expect(prompt).toContain("85");
    expect(prompt).toContain("包含夸张用语");
    expect(prompt).toContain("深度搜索分析");
  });
});
