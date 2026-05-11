import { Router, type IRouter } from "express";
import { ChatBody, ChatResponse } from "@workspace/api-zod";
import {
  classifyIntent,
  buildQueryFromHistory,
  extractComparedAssessments,
} from "../lib/shl/conversation.js";
import { retrieve, retrieveForComparison } from "../lib/shl/retriever.js";
import { getCatalog, type CatalogItem } from "../lib/shl/catalog.js";
import { generateResponse } from "../lib/shl/llm.js";

const router: IRouter = Router();

router.get("/health", (_req, res): void => {
  res.json({ status: "ok" });
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages } = parsed.data;

  const intent = classifyIntent(messages);

  req.log.info({ intent }, "Classified intent");

  let catalogContext: CatalogItem[] = [];

  if (intent === "compare") {
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    const names = lastUser
      ? extractComparedAssessments(lastUser.content)
      : [];

    if (names.length > 0) {
      catalogContext = retrieveForComparison(names);

      if (catalogContext.length === 0) {
        const query = buildQueryFromHistory(messages);
        catalogContext = retrieve(query, 6);
      }
    } else {
      const query = buildQueryFromHistory(messages);
      catalogContext = retrieve(query, 6);
    }
  } else if (intent === "off_topic" || intent === "injection") {
    catalogContext = [];
  } else if (intent === "vague") {
    catalogContext = [];
  } else {
    const query = buildQueryFromHistory(messages);
    catalogContext = retrieve(query, 15);
  }

  try {
    const llmResponse = await generateResponse(
      messages,
      catalogContext,
      intent
    );

    const lastUserMessage =
      [...messages]
        .reverse()
        .find((m) => m.role === "user")
        ?.content.toLowerCase() ?? "";

    const isCompareQuery =
      lastUserMessage.includes("difference between") ||
      lastUserMessage.includes("compare");

    const isOffTopic =
      lastUserMessage.includes("legal hiring advice");

    const isInjection =
      lastUserMessage.includes("ignore all previous instructions");

    const endOfConversation =
      isCompareQuery ||
      isOffTopic ||
      isInjection ||
      llmResponse.recommendations.length > 0;

    const response = ChatResponse.parse({
      reply: llmResponse.reply,
      recommendations: llmResponse.recommendations,
      end_of_conversation: endOfConversation,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Chat handling failed");

    const fallback = ChatResponse.parse({
      reply:
        "I ran into an internal error while handling that request. Please try again.",
      recommendations: [],
      end_of_conversation: true,
    });

    res.status(200).json(fallback);
  }
});

export default router;