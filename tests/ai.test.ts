import { describe, test, expect } from "bun:test";
import {
  SCORE_SYSTEM_PROMPT,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  buildScorePrompt,
  buildDeepAnalysisPrompt,
} from "../src/ai/prompts";
import { MockAIProvider } from "../src/ai/index";
import type { ScoreResult, DeepAnalysisResult } from "../src/ai/index";

// ── Prompt tests ───────────────────────────────────────────────────

describe("Phase 1: Score Prompts", () => {
  test("SCORE_SYSTEM_PROMPT contains scoring instructions", () => {
    expect(SCORE_SYSTEM_PROMPT).toContain("标题党");
    expect(SCORE_SYSTEM_PROMPT).toContain("isClickbait");
    expect(SCORE_SYSTEM_PROMPT).toContain("score");
    expect(SCORE_SYSTEM_PROMPT).toContain("reason");
    expect(SCORE_SYSTEM_PROMPT).toContain("0-100");
  });

  test("SCORE_SYSTEM_PROMPT requires JSON output", () => {
    expect(SCORE_SYSTEM_PROMPT).toContain("JSON");
    expect(SCORE_SYSTEM_PROMPT).toContain("仅返回 JSON");
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

  test("DEEP_ANALYSIS_SYSTEM_PROMPT requires structured output", () => {
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("JSON");
    expect(DEEP_ANALYSIS_SYSTEM_PROMPT).toContain("标题手法分析");
  });

  test("buildDeepAnalysisPrompt includes title, score, and reason", () => {
    const prompt = buildDeepAnalysisPrompt("可疑标题", 85, "包含夸张用语");
    expect(prompt).toContain("可疑标题");
    expect(prompt).toContain("85");
    expect(prompt).toContain("包含夸张用语");
    expect(prompt).toContain("深度搜索分析");
  });

  test("buildDeepAnalysisPrompt includes initial score context", () => {
    const prompt = buildDeepAnalysisPrompt("震惊！大事件", 92, "夸张用语");
    expect(prompt).toContain("初步评分");
    expect(prompt).toContain("92");
    expect(prompt).toContain("初步判定理由");
  });
});

// ── MockAIProvider tests ───────────────────────────────────────────

describe("MockAIProvider.score()", () => {
  const mock = new MockAIProvider();

  test("modelName is mock", () => {
    expect(mock.modelName).toBe("mock");
  });

  test("flags clickbait title with high score", async () => {
    const result = await mock.score("震惊！你绝对想不到这件事的真相");
    expect(result.isClickbait).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reason).toContain("标题党");
  });

  test("flags normal title with low score", async () => {
    const result = await mock.score("教育部发布2026年高考新政策");
    expect(result.isClickbait).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(30);
    expect(result.reason).toContain("客观");
  });

  test("detects multiple clickbait keywords", async () => {
    const result = await mock.score("竟然有人独家揭秘月入过万的真相");
    expect(result.isClickbait).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  test("returns valid ScoreResult shape", async () => {
    const result: ScoreResult = await mock.score("任意标题");
    expect(typeof result.isClickbait).toBe("boolean");
    expect(typeof result.score).toBe("number");
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe("MockAIProvider.deepAnalyze()", () => {
  const mock = new MockAIProvider();

  test("returns structured deep analysis for high-score clickbait", async () => {
    const result = await mock.deepAnalyze("震惊！真相来了", 90, "夸张用语");
    expect(result.deepAnalysis).toContain("标题手法分析");
    expect(result.deepAnalysis).toContain("事实偏差评估");
    expect(result.deepAnalysis).toContain("90/100");
    expect(result.verdict).toContain("高度疑似标题党");
  });

  test("returns moderate verdict for mid-score items", async () => {
    const result = await mock.deepAnalyze("速看！新规出台", 65, "存在一定夸大");
    expect(result.verdict).toContain("存在标题党嫌疑");
  });

  test("returns mild verdict for low-score items", async () => {
    const result = await mock.deepAnalyze("普通标题", 40, "基本客观");
    expect(result.verdict).toContain("基本客观");
  });

  test("includes matched keywords in analysis", async () => {
    const result = await mock.deepAnalyze("独家揭秘内幕", 85, "标题党");
    expect(result.deepAnalysis).toContain("独家揭秘");
    expect(result.deepAnalysis).toContain("内幕");
  });

  test("returns valid DeepAnalysisResult shape", async () => {
    const result: DeepAnalysisResult = await mock.deepAnalyze("标题", 50, "理由");
    expect(typeof result.deepAnalysis).toBe("string");
    expect(typeof result.verdict).toBe("string");
    expect(result.deepAnalysis.length).toBeGreaterThan(0);
    expect(result.verdict.length).toBeGreaterThan(0);
  });
});
