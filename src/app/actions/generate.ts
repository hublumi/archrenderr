"use server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

// Mapa global para Rate Limiting na memória (útil para invocations aquecidas no serverless)
// Chave: ID do usuário ou IP, Valor: timestamp da última requisição
const rateLimitMap = new Map<string, number>();
const COOLDOWN_MS = 15000; // 15 segundos entre requisições

export async function generateProductImage(formData: FormData) {
  // Identificação do Usuário e IP
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") || "unknown_ip";
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const identifier = user?.id || ip;
  const now = Date.now();
  const lastRequest = rateLimitMap.get(identifier);
  
  // Rate Limiting (Proteção contra loops e cliques múltiplos)
  if (lastRequest && now - lastRequest < COOLDOWN_MS) {
    const waitTime = Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000);
    return { 
      success: false, 
      error: `Por favor, aguarde ${waitTime} segundos antes de gerar outra imagem. Isso evita sobrecarga no sistema.` 
    };
  }

  // Verificação de Tokens no Servidor (Segurança)
  if (!user) {
    return { success: false, error: "Você precisa estar logado para gerar imagens." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tokens")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tokens <= 0) {
    return { success: false, error: "Você não possui tokens suficientes. Por favor, adquira mais." };
  }

  // Limpeza preventiva do mapa
  if (rateLimitMap.size > 1000) {
    const entries = Array.from(rateLimitMap.entries());
    const recentEntries = entries.filter(([_, time]) => now - time < COOLDOWN_MS);
    rateLimitMap.clear();
    recentEntries.forEach(([key, time]) => rateLimitMap.set(key, time));
  }
  
  rateLimitMap.set(identifier, now);

  // Extract data
  const product = formData.get("product");
  const color = formData.get("color") || "#FFFFFF";

  if (!product) {
    return { success: false, error: "Produto é obrigatório" };
  }

  const productFile = product as File;
  const buffer = await productFile.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${productFile.type};base64,${base64}`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: "CHAVE DA OPENAI NÃO ENCONTRADA. Você precisa colar a sua chave (sk-proj-...) no arquivo .env.local e REINICIAR O SERVIDOR."
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const fullPrompt = `Analyze the input product image with extreme precision. Generate a highly detailed and structured description including: - exact product type - exact shape and proportions - exact colors (use precise color names, no approximations) - materials and finishes (matte, glossy, metallic, etc.) - textures and surface details - logos, texts, and branding (copy exactly if visible) - any unique visual characteristics. IMPORTANT: - Do not generalize anything - Do not simplify - Do not omit details - This description will be used to recreate the product with high fidelity. Also include: - camera angle - perspective - lighting direction (if visible)

Create a hyper-realistic professional studio product photo. The product must match EXACTLY the input image and the description. STRICT RULES: - The product must be identical in shape, color, material, and details - Do not redesign or reinterpret - Do not improve or stylize the product itself STYLE: - ultra high-end commercial photography - soft diffused studio lighting - realistic shadows and reflections - perfect exposure - extremely sharp focus - 8k, ultra detailed BACKGROUND: - solid studio background in ${color} - smooth and clean - subtle gradient for realism COMPOSITION: - centered product - premium e-commerce framing - no extra objects CAMERA: - 85mm lens - professional product photography - shallow depth of field (subtle) QUALITY BOOST: - photorealistic - global illumination - ray-traced lighting - physically accurate materials. This must look like a real photograph taken in a professional studio, not a 3D render or AI-generated image.`;



    // Etapa 1: Usar GPT-4o para descrever perfeitamente o produto
    console.log("Analisando o produto com GPT-4o...");
    
    const promptEtapa1 = `Analyze the input product image with extreme precision. Generate a highly detailed and structured description including: - exact product type - exact shape and proportions - exact colors (use precise color names, no approximations) - materials and finishes (matte, glossy, metallic, etc.) - textures and surface details - logos, texts, and branding (copy exactly if visible) - any unique visual characteristics. IMPORTANT: - Do not generalize anything - Do not simplify - Do not omit details - This description will be used to recreate the product with high fidelity. Also include: - camera angle - perspective - lighting direction (if visible)`;

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: promptEtapa1
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${productFile.type};base64,${base64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    const intelligentPrompt = visionResponse.choices[0].message.content?.trim() || "A highly detailed product photography.";
    console.log("Descrição gerada pelo GPT-4o (Etapa 1):", intelligentPrompt);

    // Etapa 2: Gerar a imagem com DALL-E 3 usando a descrição
    console.log("Gerando imagem final com DALL-E 3 (Etapa 2)...");
    
    let promptEtapa2 = `Create a hyper-realistic professional studio product photo. The product must match EXACTLY the following description: ${intelligentPrompt} STRICT RULES: - The product must be identical in shape, color, material, and details - Do not redesign or reinterpret - Do not improve or stylize the product itself STYLE: - ultra high-end commercial photography - soft diffused studio lighting - realistic shadows and reflections - perfect exposure - extremely sharp focus - 8k, ultra detailed BACKGROUND: - solid studio background in ${color} - smooth and clean - subtle gradient for realism COMPOSITION: - centered product - premium e-commerce framing - no extra objects CAMERA: - 85mm lens - professional product photography - shallow depth of field (subtle) QUALITY BOOST: - photorealistic - global illumination - ray-traced lighting - physically accurate materials. This must look like a real photograph taken in a professional studio, not a 3D render or AI-generated image.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: promptEtapa2,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
    });

    const b64Json = imageResponse.data[0].b64_json;
    if (!b64Json) throw new Error("A OpenAI não retornou a imagem base64.");

    const finalDataUrl = `data:image/png;base64,${b64Json}`;

    // Desconta o token do usuário no banco de dados DEPOIS que a imagem foi gerada com sucesso
    const newTokens = profile.tokens - 1;
    await supabase.from("profiles").update({ tokens: newTokens }).eq("id", user.id);

    return {
      success: true,
      imageUrl: finalDataUrl, // A imagem final com o produto e cenário
      backgroundImageUrl: null,
      newTokens: newTokens
    };
  } catch (error: any) {
    console.error("Erro detalhado na integração com OpenAI:", error.message || error);
    
    // Libera o rate limit em caso de erro para não penalizar o usuário
    rateLimitMap.set(identifier, now - COOLDOWN_MS + 5000); 

    return {
      success: false,
      error: `Erro: ${error.message || "Verifique a configuração."}`
    };
  }
}
