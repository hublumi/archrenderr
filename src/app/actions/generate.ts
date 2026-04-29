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

    // 2. Prompts Refinados em formato de linha única para evitar travamentos
    let taskPrompt = `TASK: Use image_generation to place this product in a premium studio background in ${color} with soft lighting. Aspect ratio: ${aspectRatio}. ABSOLUTE REQUIREMENT: Keep the product's shape, typography, and textures 100% identical. OUTPUT a standard web-optimized resolution image.`;

    if (mode === "macro") {
      taskPrompt = `TASK: Use image_generation to create a professional EXTREME CLOSE-UP (MACRO) shot of this product. SETTING: Premium studio environment in ${color}. ABSOLUTE REQUIREMENT: Maintain 100% fidelity to the original product's typography and textures. OUTPUT a standard web-optimized resolution image.`;
    } else if (mode === "change_color") {
      taskPrompt = `TASK: Use image_generation to change the studio background color to ${color}. ABSOLUTE REQUIREMENT: Keep the product 100% identical. OUTPUT a standard web-optimized resolution image.`;
    }

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: taskPrompt },
            { type: "input_image", image_url: `data:${product.type};base64,${base64}` }
          ]
        }
      ],
      tools: [{ type: "image_generation" }]
    } as any);

    if (!response || !response.output || !Array.isArray(response.output)) {
      console.error(">>> RESPONSE INESPERADO:", JSON.stringify(response));
      throw new Error("A API da OpenAI falhou silenciosamente ou enviou formato inválido.");
    }

    const toolOutput = response.output.find((o: any) => o.type === "image_generation_call");
    if (!toolOutput) {
      const refusal = response.output.find((o: any) => o.type === "refusal");
      throw new Error(refusal?.content || "A IA recusou a geração. Verifique se a foto é legível.");
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
