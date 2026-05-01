'use server';

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@/utils/supabase/server';

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' 
});

export async function createPixPayment(packageInfo: { id: string, name: string, price: number, tokens: number }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Erro de autenticação MP:", authError);
      throw new Error("Usuário não autenticado");
    }

    const payment = new Payment(mpClient);
    const userEmail = user.email || 'teste@nuvematelie.com';

    const body = {
      transaction_amount: packageInfo.price,
      description: `Compra de ${packageInfo.tokens} créditos - Nuvem Ateliê`,
      payment_method_id: 'pix',
      payer: {
        email: userEmail,
        first_name: 'Cliente',
        last_name: 'Nuvem Ateliê',
      },
      metadata: {
        user_id: user.id,
        tokens_to_add: packageInfo.tokens,
        package_id: packageInfo.id
      }
    };

    const response = await payment.create({ body });

    return {
      success: true,
      qrCode: response.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      id: response.id
    };
  } catch (error: any) {
    console.error("Erro ao criar pagamento Pix:", error);
    return {
      success: false,
      error: error.message || "Erro ao gerar o Pix"
    };
  }
}

export async function checkPaymentStatus(paymentId: number) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const payment = new Payment(mpClient);
    const paymentData = await payment.get({ id: paymentId });

    if (paymentData.status === 'approved') {
      const { user_id, tokens_to_add } = paymentData.metadata;

      // Buscar tokens atuais
      const { data: profile } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('id', user_id)
        .single();

      if (profile) {
        const newTotal = (profile.tokens || 0) + parseInt(tokens_to_add);
        
        // Atualizar tokens
        await supabase
          .from('profiles')
          .update({ tokens: newTotal })
          .eq('id', user_id);

        return { success: true, status: 'approved', newTokens: newTotal };
      }
    }

    return { success: true, status: paymentData.status };
  } catch (error: any) {
    console.error("Erro ao verificar status do pagamento:", error);
    return { success: false, error: error.message };
  }
}


