import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import {
  SCORE_SYSTEM_PROMPT,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  buildScorePrompt,
  buildDeepAnalysisPrompt,
} from "./prompts";

// ── Result types ───────────────────────────────────────────────────

export interface ScoreResult {
  isClickbait: boolean;
  score: number;
  reason: string;
}

export interface DeepAnalysisResult {
  deepAnalysis: string;
  verdict: string;
}

// ── Provider interface ─────────────────────────────────────────────

export interface AIProvider {
  readonly modelName: string;
  score(title: string): Promise<ScoreResult>;
  deepAnalyze(title: string, score: number, reason: string): Promise<DeepAnalysisResult>;
}

function parseJSON<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

// ── Google Gemini ──────────────────────────────────────────────────

class GoogleAIProvider implements AIProvider {
  readonly modelName = "gemini-2.0-flash";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async score(title: string): Promise<ScoreResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SCORE_SYSTEM_PROMPT,
    });
    const result = await model.generateContent(buildScorePrompt(title));
    return parseJSON<ScoreResult>(result.response.text());
  }

  async deepAnalyze(title: string, sc: number, reason: string): Promise<DeepAnalysisResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: DEEP_ANALYSIS_SYSTEM_PROMPT,
    });
    const result = await model.generateContent(buildDeepAnalysisPrompt(title, sc, reason));
    return parseJSON<DeepAnalysisResult>(result.response.text());
  }
}

// ── OpenAI-compatible (OpenAI + DeepSeek) ──────────────────────────

class OpenAICompatibleProvider implements AIProvider {
  readonly modelName: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(opts: { model: string; baseUrl: string; apiKey: string }) {
    this.modelName = opts.model;
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
  }

  private async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`${this.modelName} API ${resp.status}: ${body}`);
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return json.choices[0].message.content;
  }

  async score(title: string): Promise<ScoreResult> {
    const text = await this.chat(SCORE_SYSTEM_PROMPT, buildScorePrompt(title));
    return parseJSON<ScoreResult>(text);
  }

  async deepAnalyze(title: string, sc: number, reason: string): Promise<DeepAnalysisResult> {
    const text = await this.chat(
      DEEP_ANALYSIS_SYSTEM_PROMPT,
      buildDeepAnalysisPrompt(title, sc, reason),
    );
    return parseJSON<DeepAnalysisResult>(text);
  }
}

// ── Mock (keyword-based, no API needed) ────────────────────────────

class MockAIProvider implements AIProvider {
  readonly modelName = "mock";

  private static CLICKBAIT_KEYWORDS = [
    "震惊", "绝对想不到", "真相", "竟然", "月入过万",
    "速看", "独家揭秘", "内幕", "不知道的", "居然",
  ];

  async score(title: string): Promise<ScoreResult> {
    const isClickbait = MockAIProvider.CLICKBAIT_KEYWORDS.some((kw) => title.includes(kw));
    const score = isClickbait
      ? 70 + Math.floor(Math.random() * 30)
      : Math.floor(Math.random() * 30);
    return {
      isClickbait,
      score,
      reason: isClickbait
        ? "标题包含典型标题党用语，可能存在夸大或误导"
        : "标题描述较为客观，未发现明显标题党特征",
    };
  }

  async deepAnalyze(title: string, sc: number, reason: string): Promise<DeepAnalysisResult> {
    const matched = MockAIProvider.CLICKBAIT_KEYWORDS.filter((kw) => title.includes(kw));
    return {
      deepAnalysis:
        `【标题手法分析】该标题使用了${matched.length > 0 ? `"${matched.join('", "')}"等` : ""}情绪化表述手法，` +
        `通过制造悬念和夸张来吸引用户点击。` +
        `【事实偏差评估】初步评分为 ${sc}/100，${reason}。` +
        `经深度分析，标题存在明显的信息不对称，核心事实可能被选择性呈现或夸大。` +
        `【结论】建议读者保持理性，关注权威信息源获取完整信息。`,
      verdict: sc >= 80
        ? "高度疑似标题党，标题严重偏离事实核心"
        : sc >= 60
          ? "存在标题党嫌疑，标题有一定程度的夸大"
          : "标题基本客观，但表述方式有待改善",
    };
  }
}

// ── Factory ────────────────────────────────────────────────────────

function createProvider(): AIProvider {
  switch (config.AI_PROVIDER) {
    case "google":
      if (!config.GOOGLE_AI_API_KEY) {
        console.warn("⚠️ GOOGLE_AI_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new GoogleAIProvider(config.GOOGLE_AI_API_KEY);

    case "openai":
      if (!config.OPENAI_API_KEY) {
        console.warn("⚠️ OPENAI_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new OpenAICompatibleProvider({
        model: "gpt-4o-mini",
        baseUrl: "https://api.openai.com/v1",
        apiKey: config.OPENAI_API_KEY,
      });

    case "deepseek":
      if (!config.DEEPSEEK_API_KEY) {
        console.warn("⚠️ DEEPSEEK_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new OpenAICompatibleProvider({
        model: "deepseek-chat",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: config.DEEPSEEK_API_KEY,
      });

    default:
      return new MockAIProvider();
  }
}

export const aiProvider = createProvider();
