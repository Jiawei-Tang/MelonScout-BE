import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import {
  TRIAGE_SYSTEM_PROMPT,
  FACT_CHECK_SYSTEM_PROMPT,
  buildTriagePrompt,
  buildFactCheckPrompt,
} from "./prompts";

// ── Result types ───────────────────────────────────────────────────

export interface TriageResult {
  needsFactCheck: boolean;
  triageReason: string;
  category: string;
}

export interface FactCheckResult {
  isClickbait: boolean;
  score: number;
  reason: string;
  deepAnalysis: string;
  verdict: string;
}

// ── Provider interface ─────────────────────────────────────────────

export interface AIProvider {
  readonly modelName: string;
  triage(title: string): Promise<TriageResult>;
  factCheck(title: string, category: string, triageReason: string): Promise<FactCheckResult>;
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

  async triage(title: string): Promise<TriageResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: TRIAGE_SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildTriagePrompt(title));
    return parseJSON<TriageResult>(result.response.text());
  }

  async factCheck(title: string, category: string, triageReason: string): Promise<FactCheckResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: FACT_CHECK_SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildFactCheckPrompt(title, category, triageReason));
    return parseJSON<FactCheckResult>(result.response.text());
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

  async triage(title: string): Promise<TriageResult> {
    const text = await this.chat(TRIAGE_SYSTEM_PROMPT, buildTriagePrompt(title));
    return parseJSON<TriageResult>(text);
  }

  async factCheck(title: string, category: string, triageReason: string): Promise<FactCheckResult> {
    const text = await this.chat(FACT_CHECK_SYSTEM_PROMPT, buildFactCheckPrompt(title, category, triageReason));
    return parseJSON<FactCheckResult>(text);
  }
}

// ── MiniMax ────────────────────────────────────────────────────────

class MiniMaxProvider implements AIProvider {
  readonly modelName = "MiniMax-M2.5";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const resp = await fetch("https://api.minimaxi.com/v1/text/chatcompletion_v2", {
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
        stream: false,
        temperature: 0.2,
        top_p: 0.9,
        max_completion_tokens: 2048,
      }),
    });

    const json = (await resp.json()) as {
      base_resp?: { status_code: number; status_msg: string };
      choices?: Array<{ message: { content: string } }>;
    };

    if (json.base_resp && json.base_resp.status_code !== 0) {
      throw new Error(
        `MiniMax API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`,
      );
    }

    if (!resp.ok) {
      throw new Error(`MiniMax API HTTP ${resp.status}: ${JSON.stringify(json)}`);
    }

    const content = json.choices?.[0]?.message?.content;
    if (content == null) {
      throw new Error(`MiniMax API unexpected response: ${JSON.stringify(json)}`);
    }
    return content;
  }

  async triage(title: string): Promise<TriageResult> {
    const text = await this.chat(TRIAGE_SYSTEM_PROMPT, buildTriagePrompt(title));
    return parseJSON<TriageResult>(text);
  }

  async factCheck(title: string, category: string, triageReason: string): Promise<FactCheckResult> {
    const text = await this.chat(FACT_CHECK_SYSTEM_PROMPT, buildFactCheckPrompt(title, category, triageReason));
    return parseJSON<FactCheckResult>(text);
  }
}

// ── Doubao (豆包 / 火山方舟) ──────────────────────────────────────

interface DoubaoResponseOutput {
  type: string;
  role?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface DoubaoResponse {
  id: string;
  output: DoubaoResponseOutput[];
  error?: { code: string; message: string };
}

class DoubaoProvider implements AIProvider {
  readonly modelName: string;
  private apiKey: string;
  private baseUrl = "https://ark.cn-beijing.volces.com/api/v3/responses";

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private extractText(resp: DoubaoResponse): string {
    if (resp.error) {
      throw new Error(`Doubao API error: ${resp.error.code} ${resp.error.message}`);
    }
    for (const item of resp.output) {
      if (item.type === "message" && item.content) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.text) {
            return block.text;
          }
        }
      }
    }
    throw new Error(`Doubao API: no text in response: ${JSON.stringify(resp)}`);
  }

  private async call(
    systemPrompt: string,
    userPrompt: string,
    useWebSearch: boolean,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.modelName,
      temperature: 0.2,
      top_p: 0.9,
      max_output_tokens: 2048,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    };

    if (useWebSearch) {
      body.tools = [{ type: "web_search", max_keyword: 3 }];
    }

    const resp = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Doubao API HTTP ${resp.status}: ${text}`);
    }

    const json = (await resp.json()) as DoubaoResponse;
    return this.extractText(json);
  }

  async triage(title: string): Promise<TriageResult> {
    const text = await this.call(TRIAGE_SYSTEM_PROMPT, buildTriagePrompt(title), false);
    return parseJSON<TriageResult>(text);
  }

  async factCheck(title: string, category: string, triageReason: string): Promise<FactCheckResult> {
    const text = await this.call(
      FACT_CHECK_SYSTEM_PROMPT,
      buildFactCheckPrompt(title, category, triageReason),
      true,
    );
    return parseJSON<FactCheckResult>(text);
  }
}

// ── Mock (keyword-based, no API needed) ────────────────────────────

export class MockAIProvider implements AIProvider {
  readonly modelName = "mock";

  private static FACT_CHECK_KEYWORDS = [
    "震惊", "绝对想不到", "真相", "竟然", "月入过万",
    "速看", "独家揭秘", "内幕", "不知道的", "居然",
  ];

  private static SCANDAL_KEYWORDS = ["出轨", "吸毒", "被捕", "劈腿", "家暴"];
  private static CORPORATE_KEYWORDS = ["获奖", "荣获", "获得", "夺得", "斩获"];
  private static POLICY_KEYWORDS = ["新政策", "新政", "新规", "发布"];

  async triage(title: string): Promise<TriageResult> {
    if (MockAIProvider.FACT_CHECK_KEYWORDS.some((kw) => title.includes(kw))) {
      return { needsFactCheck: true, triageReason: "标题包含典型标题党用语", category: "clickbait" };
    }
    if (MockAIProvider.SCANDAL_KEYWORDS.some((kw) => title.includes(kw))) {
      return { needsFactCheck: true, triageReason: "涉及名人丑闻，需核实来源", category: "celebrity_scandal" };
    }
    if (MockAIProvider.CORPORATE_KEYWORDS.some((kw) => title.includes(kw))) {
      return { needsFactCheck: true, triageReason: "涉及企业成就声明，需核查归属", category: "corporate_claim" };
    }
    if (MockAIProvider.POLICY_KEYWORDS.some((kw) => title.includes(kw))) {
      return { needsFactCheck: true, triageReason: "涉及政策变动，需核实准确性", category: "policy" };
    }
    return { needsFactCheck: false, triageReason: "标题表述正常，无需特别核查", category: "normal" };
  }

  async factCheck(title: string, category: string, _triageReason: string): Promise<FactCheckResult> {
    const isClickbait = MockAIProvider.FACT_CHECK_KEYWORDS.some((kw) => title.includes(kw));
    const isCorporate = category === "corporate_claim";
    const isScandal = category === "celebrity_scandal";

    let score: number;
    let reason: string;
    let deepAnalysis: string;
    let verdict: string;

    if (isClickbait) {
      score = 70 + Math.floor(Math.random() * 30);
      reason = "标题使用夸张修辞，核心事实被隐瞒或扭曲";
      deepAnalysis =
        `【表述手法】标题使用了煽动性词汇和悬念手法吸引点击。` +
        `【事实调查】经核查，标题描述的事件可能存在但被严重夸大。` +
        `【偏差评估】标题与实际情况存在较大偏差，误导分 ${score}/100。`;
      verdict = "高度标题党，内容与标题严重不符";
    } else if (isCorporate) {
      score = 40 + Math.floor(Math.random() * 30);
      reason = "企业成就归属可能存在混淆，需进一步核实";
      deepAnalysis =
        `【表述手法】标题直接将成就归属于品牌方。` +
        `【事实调查】该成就可能属于供应链合作方而非品牌方直接获得。` +
        `【偏差评估】存在归属混淆的风险，误导分 ${score}/100。`;
      verdict = "成就归属存疑，建议核实具体获奖主体";
    } else if (isScandal) {
      score = 50 + Math.floor(Math.random() * 20);
      reason = "名人丑闻消息来源未经证实";
      deepAnalysis =
        `【表述手法】标题以爆料口吻呈现未经证实的名人负面消息。` +
        `【事实调查】目前无官方或当事人证实，消息来源不明。` +
        `【偏差评估】真实性存疑，误导分 ${score}/100。`;
      verdict = "消息未经证实，建议关注官方回应";
    } else {
      score = Math.floor(Math.random() * 20);
      reason = "标题基本真实，表述较为客观";
      deepAnalysis =
        `【表述手法】标题用词中性，无明显夸大或误导。` +
        `【事实调查】标题描述内容与已知事实基本一致。` +
        `【偏差评估】标题可信度较高，误导分 ${score}/100。`;
      verdict = "经核查，标题内容基本属实";
    }

    return { isClickbait, score, reason, deepAnalysis, verdict };
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

    case "minimax": {
      const key = config.MINIMAX_API_KEY?.trim();
      if (!key) {
        console.warn("⚠️ MINIMAX_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new MiniMaxProvider(key);
    }

    case "doubao": {
      const key = config.DOUBAO_API_KEY?.trim();
      if (!key) {
        console.warn("⚠️ DOUBAO_API_KEY not set, falling back to mock AI provider");
        return new MockAIProvider();
      }
      return new DoubaoProvider(key, config.DOUBAO_MODEL);
    }

    default:
      return new MockAIProvider();
  }
}

export const aiProvider = createProvider();
