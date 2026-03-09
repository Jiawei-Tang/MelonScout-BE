import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";

export interface AnalysisResult {
  isClickbait: boolean;
  score: number;
  reason: string;
}

interface AIProvider {
  readonly modelName: string;
  analyze(title: string, description?: string | null): Promise<AnalysisResult>;
}

class GoogleAIProvider implements AIProvider {
  readonly modelName = "gemini-2.0-flash";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(title: string, description?: string | null): Promise<AnalysisResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = buildAnalysisPrompt(title, description);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    return JSON.parse(cleaned) as AnalysisResult;
  }
}

class MockAIProvider implements AIProvider {
  readonly modelName = "mock";

  async analyze(title: string): Promise<AnalysisResult> {
    const clickbaitKeywords = ["震惊", "绝对想不到", "真相", "竟然", "月入过万", "速看"];
    const isClickbait = clickbaitKeywords.some((kw) => title.includes(kw));
    const score = isClickbait ? 70 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 30);
    return {
      isClickbait,
      score,
      reason: isClickbait
        ? `标题包含典型标题党用语，可能存在夸大或误导`
        : `标题描述较为客观，未发现明显标题党特征`,
    };
  }
}

function createProvider(): AIProvider {
  switch (config.AI_PROVIDER) {
    case "google":
      if (!config.GOOGLE_AI_API_KEY) {
        console.warn("⚠️ GOOGLE_AI_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new GoogleAIProvider(config.GOOGLE_AI_API_KEY);

    case "openai":
    case "deepseek":
      console.warn(`⚠️ ${config.AI_PROVIDER} provider not yet implemented, using mock`);
      return new MockAIProvider();

    default:
      return new MockAIProvider();
  }
}

export const aiProvider = createProvider();
