"use server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

export async function generateProductImage(formData: FormData) {
  console.log(">>> INICIANDO GERAÇÃO...");

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não logado");

    const product = formData.get("product");
    const color = formData.get("color") || "#FFFFFF";
    const aspectRatio = formData.get("aspect_ratio") || "1:1";
    const mode = formData.get("mode") || "standard";

    if (!product || !(product instanceof File)) throw new Error("Arquivo inválido");

    const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single();
    if (!profile || profile.tokens <= 0) throw new Error("Sem tokens");

    const buffer = await product.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    const openai = new OpenAI({ apiKey });

    // 2. Prompts Refinados (Otimizados para evitar limites de payload e gasto excessivo)
    let taskPrompt = `TASK: Use image_generation to maintain 100% product integrity and visual consistency. 
- DO NOT ALTER the product's shape, labels, typography, or textures. 
- KEEP ALL TEXT on the product exactly as shown in the reference image.
- PLACE the product in a premium, ultra-professional studio setting with a clean background in ${color}.
- USE soft studio lighting, subtle reflections, and realistic shadows to create a high-end commercial aesthetic.
- OUTPUT a standard web-optimized resolution image (avoid massive file sizes).
- ASPECT RATIO: ${aspectRatio}.`;

    if (mode === "macro") {
      taskPrompt = `TASK: Use image_generation to create a professional EXTREME CLOSE-UP (MACRO) shot.
- ABSOLUTE CONSISTENCY REQUIRED: The product shown MUST be an exact close-up of the reference image.
- DO NOT REIMAGINE or change the product's design, text, or branding.
- FOCUS: Zoom in on a specific detail while maintaining 100% fidelity.
- SETTING: Premium studio environment with a background in ${color}.
- LIGHTING: High-end macro photography lighting to highlight fine details.
- OUTPUT a standard web-optimized resolution image.
- ASPECT RATIO: ${aspectRatio}.
- DEPTH OF FIELD: Professional shallow depth of field (bokeh) on the studio background.`;
    } else if (mode === "change_color") {
      taskPrompt = `TASK: Use image_generation to change the studio background color while keeping the product 100% identical.
- MAINTAIN total integrity of the product's shape, labels, and typography.
- BACKGROUND: Clean professional studio in ${color}.
- LIGHTING: Adjust reflections and shadows to realistically match the new background color.
- OUTPUT a standard web-optimized resolution image.
- ASPECT RATIO: ${aspectRatio}.`;
    }

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
          type: "message", // <-- ISTO ESTAVA FALTANDO E CAUSANDO O ERRO EM TODAS AS FOTOS
          role: "user",
          content: [
            { type: "input_text", text: taskPrompt },
            { type: "input_image", image_url: `data:${product.type};base64,${base64}` }
          ]
        }
      ],
      tools: [{ type: "image_generation" }]
    } as any);

    const toolOutput = (response.output as any[]).find((o: any) => o.type === "image_generation_call");
    if (!toolOutput) {
      const refusal = (response.output as any[]).find((o: any) => o.type === "refusal");
      throw new Error(refusal?.content || "A IA recusou a geração. Verifique se a foto é um produto legível.");
    }

    let finalDataUrl = toolOutput.result || toolOutput.image_url?.url || toolOutput.b64_json;
    if (finalDataUrl && !finalDataUrl.startsWith('data:') && !finalDataUrl.startsWith('http')) {
      finalDataUrl = `data:image/png;base64,${finalDataUrl}`;
    }
    
    const newTokens = profile.tokens - 1;
    await supabase.from("profiles").update({ tokens: newTokens }).eq("id", user.id);

    return { success: true, imageUrl: finalDataUrl, newTokens };

  } catch (error: any) {
    console.error(">>> ERRO:", error.message);
    return { success: false, error: error.message || "Erro de conexão com a IA" };
  }
}
