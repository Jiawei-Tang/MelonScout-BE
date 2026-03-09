export const SYSTEM_PROMPT = `你是一个专业的新闻事实核查员。你的任务是分析热搜标题。

判断是否属于"标题党"（通过夸张、悬念、隐瞒核心事实吸引点击）。
给出 0-100 的误导分（0 分为完全真实，100 分为纯粹骗点击）。
用一句话简述理由。

Output Format: 必须返回 JSON: {"isClickbait": boolean, "score": number, "reason": string}

注意：
- 仅返回 JSON，不要添加其他文字
- score 必须是 0-100 的整数
- reason 使用中文`;

export function buildAnalysisPrompt(title: string, description?: string | null): string {
  let prompt = `请分析以下热搜标题：\n\n标题：${title}`;
  if (description) {
    prompt += `\n描述：${description}`;
  }
  return prompt;
}
