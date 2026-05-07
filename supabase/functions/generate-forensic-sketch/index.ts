// Supabase Edge Function: generate-forensic-sketch
// Securely proxies image generation requests to the Lovable AI Gateway.
// The LOVABLE_API_KEY is read from Supabase secrets and never exposed to clients.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY is not configured");
      return json({ error: "Server misconfigured: missing AI key" }, 500);
    }

    let body: { prompt?: unknown; baseImage?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { prompt, baseImage } = body ?? {};

    if (typeof prompt !== "string" || prompt.trim().length < 5) {
      return json({ error: "`prompt` must be a string of at least 5 characters" }, 400);
    }
    if (prompt.length > 4000) {
      return json({ error: "`prompt` exceeds 4000 character limit" }, 400);
    }
    if (baseImage !== undefined && typeof baseImage !== "string") {
      return json({ error: "`baseImage` must be a string (data URL or URL)" }, 400);
    }

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: prompt },
    ];
    if (baseImage) {
      userContent.push({ type: "image_url", image_url: { url: baseImage } });
    }

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      },
    );

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => "");
      console.error("AI gateway error", aiRes.status, text);
      if (aiRes.status === 429) {
        return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
      }
      if (aiRes.status === 402) {
        return json(
          { error: "AI credits exhausted. Add credits in workspace settings." },
          402,
        );
      }
      return json({ error: "Image generation failed" }, 502);
    }

    const data = await aiRes.json().catch(() => null) as
      | { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }> }
      | null;
    const imageUrl =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image returned from gateway", data);
      return json({ error: "No image returned" }, 502);
    }

    return json({ imageUrl });
  } catch (err) {
    console.error("Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});
