"use server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

export async function generateProductImage(formData: FormData) {
  console.log(">>> INICIANDO ACTION NO SERVIDOR");
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Usuário não logado");
    console.log(">>> USUÁRIO OK:", user.id);

    const product = formData.get("product");
    const color = formData.get("color") || "#FFFFFF";
    const aspectRatio = formData.get("aspect_ratio") || "1:1";
    const mode = formData.get("mode") || "standard";

    if (!product || !(product instanceof File)) {
      throw new Error("Arquivo de produto inválido ou não encontrado");
    }
    console.log(">>> ARQUIVO OK:", product.name, product.size);

    const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single();
    if (!profile || profile.tokens <= 0) throw new Error("Sem tokens disponíveis");

    // Processamento da imagem
    const buffer = await product.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    console.log(">>> BASE64 GERADO");

    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) throw new Error("API Key não configurada no servidor");

    const openai = new OpenAI({ apiKey });

    let taskPrompt = `TASK: Use image_generation to edit this product. Background: professional studio in ${color}. Aspect ratio: ${aspectRatio}. Keep product 100% identical.`;
    if (mode === "macro") {
      taskPrompt = `TASK: Use image_generation to create an EXTREME CLOSE-UP MACRO shot. Focus on details. Background: professional studio in ${color}. Aspect ratio: ${aspectRatio}.`;
    }

    console.log(">>> CHAMANDO OPENAI...");
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

    console.log(">>> RESPOSTA OPENAI RECEBIDA");
    const toolOutput = (response.output as any[]).find((o: any) => o.type === "image_generation_call");
    
    if (!toolOutput) {
      const refusal = (response.output as any[]).find((o: any) => o.type === "refusal");
      throw new Error(refusal?.content || "A IA recusou a geração");
    }

    let finalDataUrl = toolOutput.result || toolOutput.image_url?.url || toolOutput.b64_json;
    
    // Garantir que seja uma URL válida para o navegador
    if (finalDataUrl && !finalDataUrl.startsWith('data:') && !finalDataUrl.startsWith('http')) {
      finalDataUrl = `data:image/png;base64,${finalDataUrl}`;
    }
    
    // Atualizar tokens
    const newTokens = profile.tokens - 1;
    await supabase.from("profiles").update({ tokens: newTokens }).eq("id", user.id);

    console.log(">>> SUCESSO TOTAL! Imagem pronta.");
    return { success: true, imageUrl: finalDataUrl, newTokens };

  } catch (error: any) {
    console.error(">>> ERRO CRÍTICO NO SERVIDOR:", error.message);
    return { success: false, error: error.message };
  }
}
