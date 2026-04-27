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

    console.log("Iniciando processamento com a nova Responses API (GPT-image-2)...");
    
    // Na Responses API de 2026, o input é multimodal e o modelo faz o "reasoning" da imagem
    const response = await openai.responses.create({
      model: "gpt-5.4", // O "Cérebro" que orquestra a tarefa
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { 
              type: "input_text", 
              text: `TASK: Use your 'image_generation' tool to edit the attached product photo.
              INSTRUCTIONS:
              - Tool Model: Use 'gpt-image-2' for maximum quality.
              - Action: Perform an 'edit' (image-to-image).
              - Goal: Change the background to a professional studio setting in ${color}.
              - Identity: The product MUST remain 100% identical in shape and color.` 
            },
            {
              type: "input_image",
              image_url: `data:${productFile.type};base64,${base64}`
            }
          ]
        }
      ],
      tools: [
        {
          type: "image_generation" // Declaramos apenas que ele PODE gerar imagens
        }
      ]
    } as any);

    // O Agente vai raciocinar e depois disparar a 'image_generation_call'
    const toolOutput = (response.output as any[]).find((o: any) => o.type === "image_generation_call");
    
    if (!toolOutput) {
      const refusal = (response.output as any[]).find((o: any) => o.type === "refusal");
      throw new Error(refusal?.content || "O agente não disparou a ferramenta de imagem.");
    }

    // Log para diagnóstico (aparecerá no seu terminal)
    console.log("DEBUG GPT-IMAGE-2 RESULT:", JSON.stringify(toolOutput, null, 2));

    let finalDataUrl = "";
    const result = toolOutput.result || toolOutput.image_url?.url || toolOutput.b64_json;

    if (typeof result === "string") {
      if (result.startsWith("http") || result.startsWith("data:")) {
        finalDataUrl = result;
      } else {
        // Se for base64 pura, adicionamos o prefixo
        finalDataUrl = `data:image/png;base64,${result}`;
      }
    }

    if (!finalDataUrl) throw new Error("Não foi possível extrair a imagem do resultado.");

    // Desconta o token do usuário
    const newTokens = profile.tokens - 1;
    await supabase.from("profiles").update({ tokens: newTokens }).eq("id", user.id);

    return {
      success: true,
      imageUrl: finalDataUrl,
      newTokens: newTokens
    };
  } catch (error: any) {
    console.error("Erro na integração com GPT-image-2:", error.message || error);
    rateLimitMap.set(identifier, now - COOLDOWN_MS + 5000); 

    return {
      success: false,
      error: `Erro no Novo Modelo: ${error.message || "Verifique sua cota da OpenAI."}`
    };
  }
}
