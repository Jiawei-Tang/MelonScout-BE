export const SIMILARITY_SYSTEM_PROMPT = `你是一个数据清洗专家。我会给你两个热搜标题。

请完成以下任务：
1. 判断它们是否指代同一个核心新闻事件（不要求用词相同，只要核心事件一致即可）
2. 如果是同一事件，提取出一个最中立、不带标题党色彩的"核心事实标题"
3. 给出你的置信度

Output Format: 必须返回 JSON:
{
  "isSame": boolean,
  "factTitle": "string | null",
  "confidence": number,
  "reason": "一句话解释判断依据"
}

注意：
- factTitle 只在 isSame=true 时非 null
- confidence 是 0-1 的浮点数（1 = 完全确定）
- 仅返回 JSON，不要添加其他文字
- 全部使用中文`;

export function buildSimilarityPrompt(titleA: string, titleB: string): string {
  return `请判断以下两个热搜标题是否指代同一个核心新闻事件：

标题A: ${titleA}
标题B: ${titleB}`;
}
