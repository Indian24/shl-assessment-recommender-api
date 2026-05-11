import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../logger.js";
import type { CatalogItem } from "./catalog.js";
import type { ChatMessage, Intent } from "./conversation.js";
import { buildSystemPrompt } from "./prompts.js";

export interface AssessmentRecommendation {
  name: string;
  url: string;
  test_type: string;
}

export interface LLMResponse {
  reply: string;
  recommendations: AssessmentRecommendation[];
  end_of_conversation: boolean;
}

function validateRecommendations(
  recs: unknown,
  catalogContext: CatalogItem[],
): AssessmentRecommendation[] {
  if (!Array.isArray(recs)) return [];

  const catalogUrls = new Set(catalogContext.map((c) => c.url));
  const catalogNames = catalogContext.map((c) => c.name.toLowerCase());

  return recs
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .filter((r) => {
      const name = (r["name"] as string | undefined)?.toLowerCase() ?? "";
      const url = (r["url"] as string | undefined) ?? "";
      return (
        (catalogUrls.has(url) ||
          catalogNames.some((cn) => name.includes(cn.split(" ")[0].toLowerCase()))) &&
        typeof r["name"] === "string" &&
        typeof r["url"] === "string" &&
        typeof r["test_type"] === "string"
      );
    })
    .map((r) => ({
      name: r["name"] as string,
      url: r["url"] as string,
      test_type: r["test_type"] as string,
    }))
    .slice(0, 10);
}

export async function generateResponse(
  messages: ChatMessage[],
  catalogContext: CatalogItem[],
  intent: Intent,
): Promise<LLMResponse> {
  const systemPrompt = buildSystemPrompt(catalogContext, intent);

  const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    max_completion_tokens: 1024,
    messages: openaiMessages,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    logger.error({ raw }, "Failed to parse LLM JSON response");
    return {
      reply: "I encountered an error processing your request. Please try again.",
      recommendations: [],
      end_of_conversation: false,
    };
  }

  const reply =
    typeof parsed["reply"] === "string"
      ? parsed["reply"]
      : "I'm here to help you find the right SHL assessments. Could you tell me more about the role you're hiring for?";

  const recommendations = validateRecommendations(parsed["recommendations"], catalogContext);

  const end_of_conversation =
    typeof parsed["end_of_conversation"] === "boolean"
      ? parsed["end_of_conversation"]
      : false;

  return { reply, recommendations, end_of_conversation };
}
