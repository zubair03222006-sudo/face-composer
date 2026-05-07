import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  prompt: z.string().min(5).max(4000),
  baseImage: z.string().optional(), // data URL for editing
});

export const generateSketch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: data.prompt },
    ];
    if (data.baseImage) {
      userContent.push({ type: "image_url", image_url: { url: data.baseImage } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      throw new Error("Image generation failed");
    }

    const json = await res.json();
    const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned");
    return { imageUrl: url };
  });
