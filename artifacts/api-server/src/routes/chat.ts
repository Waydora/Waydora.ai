import { Router, type IRouter } from "express";
import { ChatBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { ITINERARY_SYSTEM_PROMPT } from "../lib/itinerary-prompt";

const router: IRouter = Router();

router.post("/chat", async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { messages, existingItinerary } = parsed.data;

  const userTurns = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const contextMessage = existingItinerary
    ? {
        role: "system" as const,
        content: `The traveler is refining an existing itinerary. Here is the current itinerary as JSON. Modify ONLY what the latest user message asks to change, keep the rest intact:\n\n${JSON.stringify(
          existingItinerary,
        )}`,
      }
    : null;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ITINERARY_SYSTEM_PROMPT },
        ...(contextMessage ? [contextMessage] : []),
        ...userTurns,
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      req.log.error({ raw }, "Failed to parse model JSON output");
      res
        .status(502)
        .json({ error: "The travel concierge sent back an unreadable reply. Try again." });
      return;
    }

    const obj = payload as { reply?: unknown; itinerary?: unknown };
    if (typeof obj.reply !== "string" || typeof obj.itinerary !== "object" || obj.itinerary === null) {
      req.log.error({ payload }, "Model returned malformed shape");
      res
        .status(502)
        .json({ error: "The travel concierge sent back an unreadable reply. Try again." });
      return;
    }

    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Chat completion failed");
    res
      .status(500)
      .json({ error: "Something went wrong while planning your trip. Try again." });
  }
});

export default router;
