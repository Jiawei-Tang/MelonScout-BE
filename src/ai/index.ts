import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";

export interface AnalysisResult {
  isClickbait: boolean;
  score: number;
  reason: string;
}

export interface AIProvider {
  readonly modelName: string;
  analyze(title: string): Promise<AnalysisResult>;
}

function parseAIResponse(text: string): AnalysisResult {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as AnalysisResult;
}

// ── Google Gemini ──────────────────────────────────────────────────

class GoogleAIProvider implements AIProvider {
  readonly modelName = "gemini-2.0-flash";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(title: string): Promise<AnalysisResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(buildAnalysisPrompt(title));
    return parseAIResponse(result.response.text());
  }
}

// ── OpenAI-compatible (works for OpenAI + DeepSeek) ────────────────

class OpenAICompatibleProvider implements AIProvider {
  readonly modelName: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(opts: { model: string; baseUrl: string; apiKey: string }) {
    this.modelName = opts.model;
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
  }

  async analyze(title: string): Promise<AnalysisResult> {
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildAnalysisPrompt(title) },
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
    return parseAIResponse(json.choices[0].message.content);
  }
}

// ── Mock (keyword-based, no API needed) ────────────────────────────

class MockAIProvider implements AIProvider {
  readonly modelName = "mock";

  async analyze(title: string): Promise<AnalysisResult> {
    const clickbaitKeywords = [
      "震惊", "绝对想不到", "真相", "竟然", "月入过万",
      "速看", "独家揭秘", "内幕", "不知道的", "居然",
    ];
    const isClickbait = clickbaitKeywords.some((kw) => title.includes(kw));
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
