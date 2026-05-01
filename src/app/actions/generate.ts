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
    const environment = formData.get("environment") || "externo";
    const renderTime = formData.get("render_time") || "dia";
    const mode = formData.get("mode") || "standard";

    if (!product || !(product instanceof File)) throw new Error("Arquivo inválido");

    const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single();
    if (!profile || profile.tokens <= 0) throw new Error("Sem tokens");

    const buffer = await product.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    const openai = new OpenAI({ apiKey });

    // Configurando a iluminação de acordo com o botão clicado
    const lightingCondition = renderTime === "noite" 
      ? "golden hour, late afternoon fading into dusk, warm sunset light, soft blue hour sky, illuminated interior warm lights, not too dark"
      : "bright broad daylight, natural sunlight, clear blue sky, realistic sunny architectural lighting";

    let taskPrompt = "";
    if (environment === "interno") {
      taskPrompt = `TASK: Photorealistic interior architectural photograph. STRICT: Preserve 100% original geometric structure, camera angle, furniture layout. MATERIALS: Render existing materials (wood, stone, glass) with extreme physical accuracy, natural reflections. ENVIRONMENT: Convert white/abstract outdoor shapes into lush green jungle landscape. STYLE: Real photo, DSLR, high-end magazine, NOT a 3D render. LIGHTING: ${lightingCondition}.`;
    } else {
      taskPrompt = `TASK: Photorealistic exterior architectural photograph. STRICT: Preserve 100% original building envelope, geometry, scale. MATERIALS: Render existing materials with extreme physical accuracy, realistic weathering. ENVIRONMENT: Convert abstract shapes into photorealistic surrounding landscape. STYLE: Real photo, tilt-shift DSLR, NOT a 3D render. LIGHTING: ${lightingCondition}.`;
    }

    console.log(`>>> GERAÇÃO SOLICITADA. Ambiente: ${environment} | Clima: ${renderTime}`);
    console.log(`>>> PROMPT: ${taskPrompt}`);

    if (mode === "macro") {
      taskPrompt = `TASK: Use image_generation to create a professional EXTREME CLOSE-UP detail shot of this architecture. SETTING: ${lightingCondition}. ABSOLUTE REQUIREMENT: Maintain original structural shape but apply the new lighting.`;
    }

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: taskPrompt },
            { type: "input_image", image_url: `data:${product.type};base64,${base64}`, detail: "low" }
          ]
        }
      ],
      tools: [{ type: "image_generation" }]
    } as any);

    if (!response || !response.output || !Array.isArray(response.output)) {
      console.error(">>> RESPONSE INESPERADO:", JSON.stringify(response));
      throw new Error("A API da OpenAI falhou silenciosamente ou enviou formato inválido.");
    }

    const toolOutput = (response.output as any[]).find((o: any) => o.type === "image_generation_call");
    if (!toolOutput) {
      const refusal = (response.output as any[]).find((o: any) => o.type === "refusal");
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
