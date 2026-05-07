import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const inputSchema = z.object({
  prompt: z.string().min(5).max(4000),
  baseImage: z.string().optional(),
});

/**
 * Image generation is proxied through the Supabase Edge Function
 * `generate-forensic-sketch`, which holds the LOVABLE_API_KEY server-side.
 * The frontend never sees or sends the API key.
 */
export const generateSketch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: result, error } = await supabase.functions.invoke<{
      imageUrl?: string;
      error?: string;
    }>("generate-forensic-sketch", {
      body: { prompt: data.prompt, baseImage: data.baseImage },
    });

    if (error) {
      console.error("Edge function invocation failed", error);
      throw new Error(error.message || "Image generation failed");
    }
    if (!result?.imageUrl) {
      throw new Error(result?.error || "No image returned");
    }
    return { imageUrl: result.imageUrl };
  });
