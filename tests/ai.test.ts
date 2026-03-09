import { describe, test, expect } from "bun:test";
import {
  TRIAGE_SYSTEM_PROMPT,
  FACT_CHECK_SYSTEM_PROMPT,
  buildTriagePrompt,
  buildFactCheckPrompt,
} from "../src/ai/prompts";
import { MockAIProvider } from "../src/ai/index";
import type { TriageResult, FactCheckResult } from "../src/ai/index";

// ── Triage Prompt tests ────────────────────────────────────────────

describe("Phase 1: Triage Prompts", () => {
  test("TRIAGE_SYSTEM_PROMPT covers clickbait detection", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toContain("标题党");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("needsFactCheck");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("category");
  });

  test("TRIAGE_SYSTEM_PROMPT covers celebrity scandals", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toContain("出轨");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("吸毒");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("celebrity_scandal");
  });

  test("TRIAGE_SYSTEM_PROMPT covers corporate claims", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toContain("供应商");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("混淆归属");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("corporate_claim");
  });

  test("TRIAGE_SYSTEM_PROMPT requires JSON output", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toContain("JSON");
    expect(TRIAGE_SYSTEM_PROMPT).toContain("triageReason");
  });

  test("buildTriagePrompt includes title", () => {
    const prompt = buildTriagePrompt("测试标题");
    expect(prompt).toContain("测试标题");
    expect(prompt).toContain("事实核查");
  });
});

// ── Fact-check Prompt tests ────────────────────────────────────────

describe("Phase 2: Fact-check Prompts", () => {
  test("FACT_CHECK_SYSTEM_PROMPT contains investigation instructions", () => {
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("事实核查");
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("deepAnalysis");
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("verdict");
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("score");
  });

  test("FACT_CHECK_SYSTEM_PROMPT requires score even for true titles", () => {
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("isClickbait = false");
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("必须给出 score");
  });

  test("FACT_CHECK_SYSTEM_PROMPT covers corporate attribution", () => {
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("供应商");
    expect(FACT_CHECK_SYSTEM_PROMPT).toContain("归属混淆");
  });

  test("buildFactCheckPrompt includes all context", () => {
    const prompt = buildFactCheckPrompt("某公司获奖", "corporate_claim", "需核查归属");
    expect(prompt).toContain("某公司获奖");
    expect(prompt).toContain("corporate_claim");
    expect(prompt).toContain("需核查归属");
  });
});

// ── MockAIProvider.triage() ────────────────────────────────────────

describe("MockAIProvider.triage()", () => {
  const mock = new MockAIProvider();

  test("modelName is mock", () => {
    expect(mock.modelName).toBe("mock");
  });

  test("flags clickbait titles", async () => {
    const r = await mock.triage("震惊！你绝对想不到这件事的真相");
    expect(r.needsFactCheck).toBe(true);
    expect(r.category).toBe("clickbait");
  });

  test("flags celebrity scandal titles", async () => {
    const r = await mock.triage("某明星被曝出轨");
    expect(r.needsFactCheck).toBe(true);
    expect(r.category).toBe("celebrity_scandal");
  });

  test("flags corporate claim titles", async () => {
    const r = await mock.triage("小米荣获国际大奖");
    expect(r.needsFactCheck).toBe(true);
    expect(r.category).toBe("corporate_claim");
  });

  test("flags policy titles", async () => {
    const r = await mock.triage("教育部发布新政策");
    expect(r.needsFactCheck).toBe(true);
    expect(r.category).toBe("policy");
  });

  test("marks normal titles as not needing fact-check", async () => {
    const r = await mock.triage("热播剧大结局收视率破纪录");
    expect(r.needsFactCheck).toBe(false);
    expect(r.category).toBe("normal");
  });

  test("returns valid TriageResult shape", async () => {
    const r: TriageResult = await mock.triage("任意标题");
    expect(typeof r.needsFactCheck).toBe("boolean");
    expect(typeof r.triageReason).toBe("string");
    expect(typeof r.category).toBe("string");
    expect(r.triageReason.length).toBeGreaterThan(0);
  });
});

// ── MockAIProvider.factCheck() ─────────────────────────────────────

describe("MockAIProvider.factCheck()", () => {
  const mock = new MockAIProvider();

  test("gives high score for clickbait", async () => {
    const r = await mock.factCheck("震惊！真相来了", "clickbait", "标题党");
    expect(r.isClickbait).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.deepAnalysis).toContain("表述手法");
    expect(r.verdict.length).toBeGreaterThan(0);
  });

  test("gives moderate score for corporate claims", async () => {
    const r = await mock.factCheck("XX公司获奖", "corporate_claim", "归属存疑");
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThanOrEqual(70);
    expect(r.deepAnalysis).toContain("供应链");
  });

  test("gives moderate score for celebrity scandals", async () => {
    const r = await mock.factCheck("某明星出轨", "celebrity_scandal", "未经证实");
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.deepAnalysis).toContain("未经证实");
  });

  test("gives low score for verified normal news", async () => {
    const r = await mock.factCheck("多地出台房产新政", "policy", "涉及政策变动");
    expect(r.isClickbait).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThan(20);
  });

  test("always returns score even for non-clickbait", async () => {
    const r = await mock.factCheck("正常新闻标题", "normal", "需核查");
    expect(typeof r.score).toBe("number");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  test("returns valid FactCheckResult shape", async () => {
    const r: FactCheckResult = await mock.factCheck("标题", "clickbait", "理由");
    expect(typeof r.isClickbait).toBe("boolean");
    expect(typeof r.score).toBe("number");
    expect(typeof r.reason).toBe("string");
    expect(typeof r.deepAnalysis).toBe("string");
    expect(typeof r.verdict).toBe("string");
  });
});
