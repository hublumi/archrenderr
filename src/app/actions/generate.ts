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

    // Prompt simplificado para evitar timeouts e cobranças excessivas
    let taskPrompt = `Professional studio photo of this product. Background color: ${color}. Aspect ratio: ${aspectRatio}. Keep product labels and typography 100% identical. High-end commercial lighting.`;
    
    if (mode === "macro") {
      taskPrompt = `Extreme macro close-up of this product. Background color: ${color}. 100% detail fidelity. Sharp focus on textures and labels.`;
    }

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
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
    if (!toolOutput) throw new Error("A IA não gerou a imagem. Tente uma foto mais clara.");

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
