import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' 
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || (await req.json()).type;
    const dataId = searchParams.get('data.id') || (await req.json()).data?.id;

    console.log(`Webhook recebido: Tipo ${type}, ID ${dataId}`);

    if (type === 'payment') {
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: dataId });

      if (paymentData.status === 'approved') {
        const { user_id, tokens_to_add } = paymentData.metadata;

        console.log(`Pagamento aprovado! Adicionando ${tokens_to_add} tokens para o usuário ${user_id}`);

        // Buscar tokens atuais
        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('id', user_id)
          .single();

        if (profile) {
          const newTotal = (profile.tokens || 0) + parseInt(tokens_to_add);
          
          // Atualizar tokens
          const { error } = await supabase
            .from('profiles')
            .update({ tokens: newTotal })
            .eq('id', user_id);

          if (error) {
            console.error("Erro ao atualizar tokens via webhook:", error);
            return NextResponse.json({ error: "Erro ao atualizar tokens" }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro no Webhook do Mercado Pago:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
