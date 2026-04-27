"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

import { generateProductImage } from "./actions/generate";
import { createPixPayment, checkPaymentStatus } from "./actions/payment";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"gerar" | "tutorial">("gerar");
  const [tokens, setTokens] = useState<number>(0);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPixCode, setShowPixCode] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{amount: number, price: number, name: string, discount: string} | null>(null);
  const [pixData, setPixData] = useState<{qrCode: string, qrCodeBase64: string, id: number} | null>(null);

  // Auth States
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot_password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchTokens(session.user.id);
      } else {
        setIsLoadingAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchTokens(session.user.id);
      } else {
        setTokens(0);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTokens = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("tokens")
      .eq("id", userId)
      .single();
    
    if (data) setTokens(data.tokens);
    setIsLoadingAuth(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsAuthLoading(true);
    
    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });
      if (error) setAuthError(error.message);
      else setAuthSuccess("Conta criada! Verifique sua caixa de e-mail para confirmar a conta antes de fazer login.");
    } else if (authMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setAuthError("Você precisa confirmar seu e-mail antes de fazer login. Verifique sua caixa de entrada.");
        } else {
          setAuthError("Credenciais inválidas ou conta não encontrada.");
        }
      }
    } else if (authMode === "forgot_password") {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setAuthError(error.message);
      else setAuthSuccess("Um link de redefinição foi enviado para o seu e-mail.");
    }
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  const [customColor, setCustomColor] = useState<string>("#FFFFFF");
  
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productPreviews, setProductPreviews] = useState<string[]>([]);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultBackground, setResultBackground] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const tokenPackages = [
    { amount: 10, price: 50, name: "10 Tokens", discount: "R$ 5,00/un" },
    { amount: 25, price: 100, name: "25 Tokens", discount: "R$ 4,00/un" },
    { amount: 50, price: 175, name: "50 Tokens", discount: "R$ 3,50/un" },
    { amount: 100, price: 300, name: "100 Tokens", discount: "Maior Desconto! R$ 3,00/un" }
  ];

  const handleBuyTokens = async (method: string) => {
    if (!selectedPackage || !user) return;
    
    if (method === 'pix') {
      setIsProcessingPayment(true);
      setError(null);
      
      try {
        const result = await createPixPayment({
          id: selectedPackage.name,
          name: selectedPackage.name,
          price: selectedPackage.price,
          tokens: selectedPackage.amount
        });

        if (result.success && result.qrCode) {
          setPixData({
            qrCode: result.qrCode,
            qrCodeBase64: result.qrCodeBase64 || '',
            id: result.id as number
          });
          setShowPixCode(true);
        } else {
          setError(result.error || "Erro ao gerar o Pix. Tente novamente.");
        }
      } catch (err) {
        setError("Erro ao conectar com o processador de pagamentos.");
      } finally {
        setIsProcessingPayment(false);
      }
    }
  };

  const handleConfirmPixPayment = async () => {
    if (!pixData) return;
    
    setIsProcessingPayment(true);
    
    try {
      const result = await checkPaymentStatus(pixData.id);
      
      if (result.success && result.status === 'approved') {
        setTokens(result.newTokens || tokens);
        setIsProcessingPayment(false);
        setShowPaymentOptions(false);
        setShowPixCode(false);
        setSelectedPackage(null);
        setPixData(null);
        alert("Pagamento aprovado! Seus créditos foram adicionados.");
      } else {
        alert("Pagamento ainda não aprovado ou pendente. Por favor, aguarde alguns instantes.");
      }
    } catch (err) {
      alert("Erro ao verificar pagamento.");
    } finally {
      setIsProcessingPayment(false);
    }
  };


  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).slice(0, 2 - productImages.length);
      if (newFiles.length > 0) {
        setProductImages((prev) => [...prev, ...newFiles]);
        setProductPreviews((prev) => [
          ...prev, 
          ...newFiles.map(file => URL.createObjectURL(file))
        ]);
        setResultImage(null); // Reset result
      }
    }
  };

  const handleGenerate = async () => {
    if (tokens <= 0) {
      setError("Você não possui tokens. Compre tokens para gerar imagens.");
      return;
    }

    if (productImages.length === 0) {
      setError("Por favor, faça upload de pelo menos uma imagem do produto.");
      return;
    }

    if (cooldown > 0) {
      setError(`Aguarde ${cooldown}s para gerar novamente.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResultImage(null);
    setResultBackground(null);

    try {
      const formData = new FormData();
      productImages.forEach((img) => formData.append("product", img));
      formData.append("studio", "limpo");
      formData.append("color", customColor);

      const result: any = await generateProductImage(formData);
      
      if (result.success) {
        setResultImage(result.imageUrl || null);
        
        if (result.newTokens !== undefined) {
          setTokens(result.newTokens);
        } else {
          setTokens(prev => prev - 1);
        }
        setCooldown(15); // Sucesso inicia cooldown de 15s
      } else {
        if (result.error?.includes("aguarde")) {
          // Tenta extrair o número de segundos da mensagem
          const match = result.error.match(/\d+/);
          if (match) setCooldown(parseInt(match[0]));
          else setCooldown(15);
        }
        setError(result.error || "Erro ao gerar a imagem. Tente novamente.");
      }
    } catch (err: any) {
      setError("Ocorreu um erro inesperado. Tente novamente em alguns segundos.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    
    try {
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atelie-nuvem-estudio-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Erro ao baixar a imagem final de estúdio.");
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-2 border-primary/10 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-primary rounded-full animate-spin"></div>
          <img src="/logo.png" alt="Logo" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 object-contain opacity-20" />
        </div>
        <p className="text-sm font-medium text-on-surface-variant/60 tracking-widest uppercase animate-pulse">Carregando seu Ateliê...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-transparent">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(41,52,58,0.08)] border border-white/50 animate-fade-in">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Logo" className="h-14 mx-auto mb-6 object-contain" />
            <h2 className="text-2xl font-bold text-on-surface">Acesse seu Ateliê</h2>
            <p className="text-sm text-on-surface-variant mt-2">
              {authMode === "login" && "Entre com seus dados para continuar"}
              {authMode === "register" && "Crie sua conta para começar a gerar"}
              {authMode === "forgot_password" && "Digite seu e-mail para receber um link de recuperação"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required={authMode === "register"}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 ml-1">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Senha</label>
                {authMode === "login" && (
                  <button type="button" onClick={() => { setAuthMode("forgot_password"); setAuthError(null); setAuthSuccess(null); }} className="text-xs font-bold text-primary hover:underline">Esqueceu a senha?</button>
                )}
              </div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`w-full mt-1 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${authMode === "forgot_password" ? 'hidden' : ''}`}
                required={authMode !== "forgot_password"}
              />
            </div>

            {authError && <p className="text-sm text-error font-medium text-center bg-error-container/20 p-2 rounded-lg">{authError}</p>}
            {authSuccess && <p className="text-sm text-primary font-medium text-center bg-[#00B1EA]/10 p-2 rounded-lg">{authSuccess}</p>}

            <button 
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-4 mt-2 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-80 flex justify-center items-center gap-2"
            >
              {isAuthLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    {authMode === "login" ? "login" : authMode === "register" ? "person_add" : "mail"}
                  </span>
                  {authMode === "login" ? "Entrar no Ateliê" : 
                   authMode === "register" ? "Criar Minha Conta" : "Enviar Recuperação"}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center flex flex-col items-center gap-2">
            {authMode !== "register" && (
              <button 
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-sm text-on-surface-variant hover:text-primary transition-colors underline font-medium"
              >
                Ainda não tem conta? Crie agora
              </button>
            )}
            {authMode !== "login" && (
              <button 
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-sm text-on-surface-variant hover:text-primary transition-colors underline font-medium"
              >
                Já tem conta? Faça login
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 glass flex items-center justify-between px-8 h-20">
        <div className="w-8"></div> {/* Spacer */}
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 absolute left-1/2 -translate-x-1/2">
          <img 
            alt="Ateliê Nuvem Logo" 
            className="h-10 w-auto object-contain" 
            src="/logo.png" 
          />
        </h1>
        <button onClick={handleLogout} className="text-on-surface-variant hover:text-error transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </header>

      <main className="pt-28 px-6 space-y-12 max-w-2xl mx-auto pb-24">
        
        {/* Navegação por Abas */}
        <div className="flex bg-surface-container-low/50 backdrop-blur-sm p-1.5 rounded-[1.25rem] w-full max-w-[260px] mx-auto shadow-inner border border-outline-variant/10">
          <button 
            onClick={() => setActiveTab("gerar")}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "gerar" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Ateliê
          </button>
          <button 
            onClick={() => setActiveTab("tutorial")}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "tutorial" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            Tutorial
          </button>
        </div>

        {activeTab === "gerar" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* Hero Section */}
        <section className="space-y-2">
          <h2 className="text-3xl font-semibold text-on-background tracking-tight leading-tight">Transforme sua arte em catálogo</h2>
          <p className="text-on-surface-variant text-base">Fotos profissionais em segundos com IA</p>
        </section>

        {/* Token Balance Section */}
        <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-on-surface">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">toll</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">Saldo Atual</p>
                <p className="text-2xl font-semibold tracking-tight">{tokens} Token{tokens !== 1 ? 's' : ''}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowPaymentOptions(!showPaymentOptions)}
              className="px-5 py-2.5 rounded-full bg-surface-container-low text-primary font-bold text-sm hover:bg-primary hover:text-white transition-all shadow-sm flex items-center gap-2 border border-primary/20"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Comprar
            </button>
          </div>

          {tokens === 0 && !showPaymentOptions && (
            <div className="p-3 bg-surface-container-low rounded-xl text-on-surface-variant text-sm font-medium flex items-center gap-2 border border-outline-variant/10">
              <span className="material-symbols-outlined text-primary text-[18px]">info</span>
              Cada imagem consome 1 token. Compre para começar.
            </div>
          )}

          {/* Payment Options (Expandable) */}
          <div className={`transition-all duration-300 overflow-hidden ${showPaymentOptions ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
            <div className="pt-4 border-t border-outline-variant/10 space-y-4">
              
              {!selectedPackage ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Escolha o Pacote</p>
                  <div className="grid grid-cols-2 gap-3">
                    {tokenPackages.map((pkg, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setSelectedPackage(pkg)}
                        className="p-3 rounded-xl border border-outline-variant/20 hover:border-primary/50 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center gap-1 group"
                      >
                        <span className="text-lg font-bold text-on-surface group-hover:text-primary">{pkg.name}</span>
                        <span className="text-sm font-medium text-on-surface-variant">R$ {pkg.price},00</span>
                        {pkg.discount && <span className="text-[10px] font-bold text-[#00B1EA] uppercase mt-1 bg-[#00B1EA]/10 px-2 py-0.5 rounded-full">{pkg.discount}</span>}
                      </button>
                    ))}
                  </div>
                </>
              ) : isProcessingPayment ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-on-surface-variant animate-pulse">Processando pagamento...</p>
                  <p className="text-xs text-on-surface-variant/60">Aguardando autorização da operadora</p>
                </div>
              ) : showPixCode ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-5 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center space-y-2 text-center">
                    <div className="w-12 h-12 bg-[#00B1EA]/10 rounded-full flex items-center justify-center text-[#00B1EA]">
                      <span className="material-symbols-outlined text-2xl">pix</span>
                    </div>
                    <p className="text-sm font-bold text-on-surface">Pague via PIX</p>
                    <p className="text-xs text-on-surface-variant">Escaneie o QR Code ou copie o código</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-outline-variant/20 shadow-sm">
                    {pixData?.qrCodeBase64 ? (
                      <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="w-32 h-32 object-contain" />
                    ) : (
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pixData?.qrCode || '')}&margin=0`} alt="QR Code PIX" className="w-32 h-32 object-contain" />
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 text-center">PIX Copia e Cola</p>
                    <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg border border-outline-variant/20">
                      <span className="text-[10px] text-on-surface font-mono truncate flex-1">{pixData?.qrCode || "Gerando código..."}</span>
                      <button 
                        className="p-2 bg-white rounded shadow-sm text-primary hover:bg-primary hover:text-white transition-colors" 
                        onClick={() => {
                          if (pixData?.qrCode) {
                            navigator.clipboard.writeText(pixData.qrCode);
                            alert("Código PIX copiado!");
                          }
                        }} 
                        title="Copiar código PIX"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                    </div>
                  </div>

                   <button 
                    onClick={handleConfirmPixPayment}
                    disabled={isProcessingPayment}
                    className="w-full py-4 mt-2 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isProcessingPayment ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    )}
                    {isProcessingPayment ? 'Verificando...' : 'Verificar Pagamento'}
                  </button>
                  <button onClick={() => setShowPixCode(false)} className="text-xs text-on-surface-variant hover:text-primary transition-colors underline">
                    Voltar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Forma de Pagamento</p>
                    <button onClick={() => setSelectedPackage(null)} className="text-xs font-bold text-primary hover:underline">Trocar Pacote</button>
                  </div>
                  
                  <div className="p-3 bg-surface-container-low rounded-xl mb-2 flex justify-between items-center border border-outline-variant/10">
                    <span className="text-sm font-medium text-on-surface-variant">Total a pagar:</span>
                    <span className="text-lg font-bold text-on-surface">R$ {selectedPackage.price},00</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      disabled
                      className="w-full py-3 px-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest opacity-60 flex items-center justify-between cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant">credit_card</span>
                        <div className="text-left">
                          <p className="text-sm font-bold text-on-surface line-through">Cartão de Crédito</p>
                          <p className="text-[10px] text-on-surface-variant font-bold text-primary">Em breve</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant text-sm">lock</span>
                    </button>

                    <button 
                      onClick={() => handleBuyTokens('pix')}
                      className="w-full py-3 px-4 rounded-xl border border-outline-variant/20 hover:border-[#00B1EA]/50 hover:bg-[#00B1EA]/5 transition-all flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-[#00B1EA] transition-colors">pix</span>
                        <div>
                          <p className="text-sm font-bold text-on-surface">PIX</p>
                          <p className="text-[10px] text-on-surface-variant">Aprovação imediata</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant group-hover:text-[#00B1EA] transition-colors text-sm">chevron_right</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Upload Area */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">Upload do Produto {productPreviews.length > 0 && <span className="text-primary normal-case ml-1">({productPreviews.length}/2)</span>}</h3>
          
          <input 
            type="file" 
            accept="image/jpeg, image/png, image/webp" 
            className="hidden" 
            ref={productInputRef}
            onChange={handleProductUpload}
            multiple
          />

          <div className="space-y-4">
            {/* Previews */}
            {productPreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {productPreviews.map((preview, index) => (
                  <div key={index} className="relative bg-surface-container-lowest rounded-xl p-2 neumorphic-soft border border-outline-variant/10 group animate-in fade-in zoom-in-95 duration-300">
                    <img src={preview} alt={`Produto ${index + 1}`} className="w-full h-32 object-contain rounded-lg bg-surface-container-low" />
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation();
                        setProductPreviews(prev => prev.filter((_, i) => i !== index));
                        setProductImages(prev => prev.filter((_, i) => i !== index)); 
                      }}
                      className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md text-error hover:scale-110 active:scale-95 transition-transform border border-outline-variant/10"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input - Show only if under 2 */}
            {productPreviews.length < 2 && (
              <div className="animate-in fade-in duration-300">
                <div 
                  onClick={() => productInputRef.current?.click()}
                  className="bg-surface-container-lowest border border-dashed border-outline-variant/40 hover:border-primary/50 hover:bg-slate-50/50 transition-all duration-300 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-sm cursor-pointer group w-full"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-on-surface">Enviar Imagem</p>
                    <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">{productPreviews.length > 0 ? "Adicionar +1 imagem" : "Tirar foto ou escolher da galeria"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Banner Tutorial */}
            <div 
              onClick={() => setActiveTab("tutorial")}
              className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-3 animate-in fade-in duration-300 cursor-pointer hover:bg-primary/10 transition-colors mt-4 shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
              </div>
              <div className="flex-1">
                <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium leading-relaxed">
                  Dúvidas sobre como tirar a foto? <strong className="text-primary hover:underline">Assista aos nossos tutoriais rápidos</strong> e obtenha resultados perfeitos!
                </p>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">chevron_right</span>
            </div>
          </div>
        </section>



        {/* Color Selector */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">Paleta de Fundo</h3>
          <div className="flex gap-4 items-center pl-1 py-2">
            <div 
              className="w-11 h-11 rounded-full shadow-md shrink-0 transition-all ring-2 ring-primary ring-offset-4 ring-offset-background"
              style={{ backgroundColor: customColor, border: customColor.toUpperCase() === '#FFFFFF' ? '1px solid #e1e9f0' : 'none' }}
            />
            
            <label className="w-11 h-11 rounded-full bg-surface-container-lowest flex items-center justify-center border border-outline-variant/20 shadow-sm cursor-pointer shrink-0 hover:bg-surface-container hover:scale-105 transition-all relative text-primary">
              <span className="material-symbols-outlined text-[20px]">palette</span>
              <input 
                type="color" 
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="absolute opacity-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
              <span className="material-symbols-outlined text-[20px]">
                {error.includes("aguarde") ? "timer" : "error"}
              </span>
            </div>
            <p className="text-sm font-semibold text-red-800 leading-tight">{error}</p>
          </div>
        )}

        {/* Main CTA */}
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || productImages.length === 0 || cooldown > 0}
          className={`w-full py-6 rounded-3xl font-bold text-base transition-all duration-500 flex items-center justify-center gap-3 ${
            isGenerating || cooldown > 0
              ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed border border-outline-variant/10" 
              : productImages.length === 0
                ? "bg-surface-container-low text-on-surface-variant/40 cursor-not-allowed grayscale border border-outline-variant/10"
                : "bg-gradient-to-r from-[#29343a] via-[#586062] to-[#29343a] bg-[length:200%_auto] hover:bg-[100%_center] text-white shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] border-t border-white/10"
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-6 h-6 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <span className="tracking-wide">Criando sua obra prima...</span>
            </>
          ) : cooldown > 0 ? (
            <>
              <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
              <span className="tracking-wide">Aguarde {cooldown}s...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-2xl">magic_button</span>
              <span className="tracking-wide">Gerar Foto de Estúdio</span>
            </>
          )}
        </button>

        {/* Preview Area */}
        <section className={`space-y-4 transition-all duration-700 ${resultImage || isGenerating ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden hidden'}`}>
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">Preview do Resultado</h3>
          <div className="relative bg-surface-container-low rounded-xl aspect-square overflow-hidden neumorphic-soft border border-white">
            
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-container-lowest">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-on-surface-variant animate-pulse">Criando magia no ateliê...</p>
              </div>
            ) : resultImage ? (
              <>
                <img 
                  alt="Resultado Gerado" 
                  className="w-full h-full object-cover" 
                  src={resultImage}
                />
                
                <button 
                  onClick={handleDownload}
                  className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-full flex items-center justify-center text-primary shadow-xl hover:scale-105 active:scale-95 transition-all outline-none"
                  aria-label="Baixar Imagem"
                >
                  <span className="material-symbols-outlined text-2xl">download</span>
                </button>
              </>
            ) : null}
            
            
          </div>
        </section>
        </div>
        )}

        {activeTab === "tutorial" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="text-center space-y-2 mb-6">
              <h2 className="text-3xl font-semibold text-on-background tracking-tight leading-tight">Como usar a plataforma</h2>
              <p className="text-on-surface-variant text-base">Aprenda com nossos tutoriais rápidos em vídeo-animação</p>
            </section>

            {/* Tutorial: Comprar Tokens */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 ml-2">1. Como comprar moedas (Tokens)</h3>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col md:flex-row items-center gap-6">
                
                <div className="w-full md:w-[45%] bg-white/50 rounded-2xl h-64 relative overflow-hidden flex items-center justify-center border border-primary/10 shadow-inner shrink-0">
                  <style>{`
                    @keyframes pixWorkflowCursor {
                      0% { transform: translate(60px, 80px); opacity: 1; }
                      8% { transform: translate(35px, -80px); opacity: 1; } /* Hover Comprar */
                      10% { transform: translate(35px, -80px) scale(0.85); opacity: 1; } /* Click */
                      12% { transform: translate(35px, -80px) scale(1); opacity: 1; }
                      22% { transform: translate(-20px, 50px); opacity: 1; } /* Hover Plan */
                      24% { transform: translate(-20px, 50px) scale(0.85); opacity: 1; } /* Click Plan */
                      26% { transform: translate(-20px, 50px) scale(1); opacity: 1; }
                      30% { opacity: 0; } /* Hide while Pix screen opens */
                      45% { transform: translate(0px, 60px); opacity: 0; }
                      48% { opacity: 1; } /* Appear on "Copiar" button */
                      50% { transform: translate(0px, 60px) scale(0.85); opacity: 1; } /* Click Copiar */
                      52% { transform: translate(0px, 60px) scale(1); opacity: 1; }
                      55% { opacity: 0; }
                      100% { opacity: 0; }
                    }
                    @keyframes pixWorkflowDrawer {
                      0%, 15% { transform: translateY(100%); }
                      20%, 30% { transform: translateY(0); }
                      35%, 100% { transform: translateY(100%); }
                    }
                    @keyframes pixWorkflowMainScreen {
                      0%, 30% { opacity: 1; transform: scale(1); }
                      35%, 70% { opacity: 0; transform: scale(0.95); } /* Hide during Pix */
                      75%, 100% { opacity: 1; transform: scale(1); }
                    }
                    @keyframes pixWorkflowPixScreen {
                      0%, 30% { opacity: 0; transform: scale(0.95); z-index: -1; }
                      35%, 70% { opacity: 1; transform: scale(1); z-index: 10; }
                      75%, 100% { opacity: 0; transform: scale(0.95); z-index: -1; }
                    }
                    @keyframes pixWorkflowCopiedMsg {
                      0%, 50% { opacity: 0; transform: translateY(10px); }
                      52%, 60% { opacity: 1; transform: translateY(0); }
                      62%, 100% { opacity: 0; transform: translateY(-10px); }
                    }
                    @keyframes pixWorkflowPaidMsg {
                      0%, 65% { opacity: 0; transform: scale(0.8); }
                      67%, 74% { opacity: 1; transform: scale(1); }
                      75%, 100% { opacity: 0; transform: scale(1.1); }
                    }
                    @keyframes pixWorkflowTokenIncrease {
                      0%, 75% { content: "0 Tokens"; color: #64748b; transform: scale(1); }
                      78%, 85% { content: "10 Tokens"; color: #10b981; transform: scale(1.1); }
                      88%, 95% { content: "10 Tokens"; color: #10b981; transform: scale(1); }
                      100% { content: "0 Tokens"; color: #64748b; transform: scale(1); }
                    }
                    .pix-token-anim::after {
                      content: "0 Tokens";
                      display: inline-block;
                      animation: pixWorkflowTokenIncrease 10s ease-in-out infinite;
                    }
                  `}</style>
                  
                  <div className="relative w-[200px] h-[220px]">
                    {/* Main UI Screen */}
                    <div className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-xl flex flex-col p-3 shadow-sm overflow-hidden" style={{ animation: 'pixWorkflowMainScreen 10s ease-in-out infinite' }}>
                      
                      {/* Balance Top */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 uppercase font-bold">Saldo Atual</span>
                          <span className="text-sm font-bold flex items-center gap-1">
                            <span className="w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center text-[10px]">✨</span>
                            <span className="pix-token-anim text-slate-500 whitespace-nowrap origin-left"></span>
                          </span>
                        </div>
                        <div className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full border border-primary/20 shadow-sm">
                          + Comprar
                        </div>
                      </div>

                      {/* Fake Content */}
                      <div className="w-full h-16 bg-slate-200 rounded-lg mb-2 opacity-50"></div>
                      <div className="w-full h-10 bg-slate-200 rounded-lg opacity-50"></div>

                      {/* Plans Drawer */}
                      <div 
                        className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 rounded-t-xl p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"
                        style={{ animation: 'pixWorkflowDrawer 10s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                      >
                        <span className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">Escolha o Pacote</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-slate-200 rounded-lg p-2 text-center bg-slate-50">
                            <span className="text-[10px] font-bold block text-slate-700">10 Tokens</span>
                            <span className="text-[8px] text-slate-500">R$ 50,00</span>
                          </div>
                          <div className="border border-slate-200 rounded-lg p-2 text-center bg-slate-50">
                            <span className="text-[10px] font-bold block text-slate-700">25 Tokens</span>
                            <span className="text-[8px] text-slate-500">R$ 100,00</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PIX UI Screen */}
                    <div className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center p-3 shadow-sm" style={{ animation: 'pixWorkflowPixScreen 10s ease-in-out infinite' }}>
                      <div className="text-[10px] font-bold text-slate-600 mb-2">Pagamento PIX</div>
                      
                      <div className="w-20 h-20 bg-slate-200 border-2 border-slate-300 rounded-lg mb-2 flex items-center justify-center relative shadow-inner">
                        <span className="material-symbols-outlined text-slate-400 text-3xl">qr_code_2</span>
                        {/* Paid overlay */}
                        <div className="absolute inset-0 bg-green-500/90 rounded-md flex items-center justify-center text-white" style={{ animation: 'pixWorkflowPaidMsg 10s ease-in-out infinite' }}>
                          <span className="material-symbols-outlined text-2xl">check_circle</span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-slate-200 rounded p-1 mb-3">
                        <div className="text-[7px] text-slate-500 font-mono text-center truncate">00020101021126580014br...</div>
                      </div>

                      <div className="bg-primary text-white text-[10px] font-bold px-4 py-1.5 rounded-full flex gap-1 relative shadow-sm">
                        Copiar Código
                        {/* Copied Tooltip */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap" style={{ animation: 'pixWorkflowCopiedMsg 10s ease-in-out infinite' }}>
                          Copiado!
                          <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mouse Cursor */}
                  <div 
                    className="absolute z-20 pointer-events-none"
                    style={{ animation: 'pixWorkflowCursor 10s ease-in-out infinite' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg scale-110">
                      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" fill="#1e293b" stroke="white" strokeWidth="1.5"/>
                    </svg>
                  </div>

                </div>

                <div className="w-full md:w-[55%] flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[24px] mt-0.5 shrink-0">shopping_cart</span>
                  <div className="text-[13px] sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                    <p className="font-bold text-primary mb-2 text-base">Passo a passo rápido:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-1">
                      <li>Clique no botão <strong className="text-primary">+ Comprar</strong>.</li>
                      <li>Um menu com os <strong>Pacotes de Tokens</strong> vai abrir na sua tela. Selecione o pacote ideal.</li>
                      <li>Você verá o <strong>QR Code PIX</strong>. Clique em "Copiar Código".</li>
                      <li>Abra o app do seu banco, use a opção "PIX Copia e Cola" e faça o pagamento.</li>
                      <li>O saldo entrará automaticamente logo após a confirmação do banco!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Tutorial: Como gerar imagem */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 ml-2">2. Como enquadrar a foto do produto</h3>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col md:flex-row items-center gap-6">
                
                <div className="w-full md:w-[35%] bg-white/50 rounded-2xl h-48 relative overflow-hidden flex items-center justify-center border border-primary/10 shadow-inner shrink-0">
                  <style>{`
                    @keyframes phoneFrameTut {
                      0% { transform: translateY(80px) scale(0.8) translateX(0); opacity: 0; }
                      15% { transform: translateY(30px) scale(1.3) translateX(15px); opacity: 1; }
                      25% { transform: translateY(30px) scale(1.3) translateX(15px); opacity: 1; }
                      40% { transform: translateY(0px) scale(1) translateX(0); opacity: 1; }
                      60% { transform: translateY(0px) scale(1) translateX(0); opacity: 1; }
                      80% { transform: translateY(80px) scale(0.8) translateX(0); opacity: 0; }
                      100% { transform: translateY(80px) scale(0.8) translateX(0); opacity: 0; }
                    }
                    @keyframes focusColorTut {
                      0%, 15% { border-color: rgba(148, 163, 184, 0.5); }
                      18%, 28% { border-color: rgba(239, 68, 68, 0.8); }
                      35%, 45% { border-color: rgba(0, 177, 234, 0.8); }
                      55%, 100% { border-color: rgba(16, 185, 129, 1); }
                    }
                    @keyframes errorCrossTut {
                      0%, 15% { opacity: 0; transform: scale(0.5); }
                      18%, 28% { opacity: 1; transform: scale(1); }
                      31%, 100% { opacity: 0; transform: scale(0.5); }
                    }
                    @keyframes cameraFlashTut {
                      0%, 53% { opacity: 0; }
                      55% { opacity: 1; }
                      65%, 100% { opacity: 0; }
                    }
                  `}</style>

                  <div className="absolute flex flex-col items-center translate-y-3 scale-110">
                    <div className="w-16 h-10 bg-slate-400 rounded-t-2xl shadow-sm" style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }}></div>
                    <div className="w-1.5 h-12 bg-slate-500"></div>
                    <div className="w-10 h-2 bg-slate-600 rounded-t-sm"></div>
                    <div className="w-20 h-1 bg-slate-300/50 rounded-[100%] mt-1 blur-[2px]"></div>
                  </div>

                  <div 
                    className="absolute z-10 w-[120px] h-[210px] bg-white/30 backdrop-blur-[3px] border-[3px] rounded-[1.4rem] flex flex-col justify-between items-center py-2 shadow-xl"
                    style={{ animation: 'phoneFrameTut 6s cubic-bezier(0.4, 0, 0.2, 1) infinite, focusColorTut 6s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                  >
                    <div className="w-8 h-1.5 bg-slate-400/60 rounded-full mt-1"></div>

                    <div className="absolute inset-0 m-auto w-20 h-20 border border-white/50 rounded flex flex-col items-center justify-center opacity-80 mix-blend-overlay">
                      <div className="w-3 h-3 border-t-2 border-l-2 border-white absolute top-0 left-0"></div>
                      <div className="w-3 h-3 border-t-2 border-r-2 border-white absolute top-0 right-0"></div>
                      <div className="w-3 h-3 border-b-2 border-l-2 border-white absolute bottom-0 left-0"></div>
                      <div className="w-3 h-3 border-b-2 border-r-2 border-white absolute bottom-0 right-0"></div>
                      
                      <div 
                        className="text-red-500 font-bold text-4xl flex items-center justify-center pointer-events-none drop-shadow-md"
                        style={{ animation: 'errorCrossTut 6s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                      >
                        ✕
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full border-[3px] border-slate-400/60 mb-1 flex items-center justify-center">
                      <div className="w-5 h-5 bg-slate-400/60 rounded-full"></div>
                    </div>

                    <div 
                      className="absolute inset-0 bg-white rounded-[1.2rem] pointer-events-none"
                      style={{ animation: 'cameraFlashTut 6s ease-in-out infinite' }}
                    ></div>
                  </div>
                </div>

                <div className="w-full md:w-[65%] flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[24px] mt-0.5 shrink-0">tips_and_updates</span>
                  <div className="text-[13px] sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                    <p className="font-bold text-primary mb-2 text-base">Para um resultado perfeito:</p>
                    <ul className="list-disc list-inside space-y-2 ml-1">
                      <li>Enquadre bem o produto para a IA reconhecer os detalhes. Não corte as bordas.</li>
                      <li>Você pode enviar até <strong>2 fotos</strong>.</li>
                      <li>A foto deve focar <strong>apenas no produto</strong>.</li>
                      <li>Evite segurar o produto com a mão.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Tutorial: O que você recebe */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 ml-2">3. O resultado profissional</h3>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col md:flex-row items-center gap-6">
                
                <div className="w-full md:w-[35%] bg-white/50 rounded-2xl h-48 relative overflow-hidden flex items-center justify-center border border-primary/10 shadow-inner shrink-0">
                  <style>{`
                    @keyframes messyWipeOut {
                      0%, 30% { clip-path: inset(0 0 0 0); }
                      35%, 70% { clip-path: inset(100% 0 0 0); }
                      75%, 100% { clip-path: inset(0 0 0 0); }
                    }
                    @keyframes aiScanLine {
                      0%, 25% { top: 0%; opacity: 0; }
                      30% { top: 0%; opacity: 1; }
                      35% { top: 100%; opacity: 1; }
                      36%, 70% { top: 100%; opacity: 0; }
                      75%, 100% { top: 0%; opacity: 0; }
                    }
                    @keyframes lampPolish {
                      0%, 30% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
                      35%, 70% { filter: drop-shadow(0 15px 10px rgba(0,0,0,0.15)); }
                      75%, 100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
                    }
                  `}</style>

                  {/* Clean Background Layer (After) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <span className="absolute top-2 left-2 bg-primary/80 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">Resultado</span>
                  </div>

                  {/* Messy Background Layer (Before) */}
                  <div 
                    className="absolute inset-0 bg-orange-50 flex items-center justify-center overflow-hidden z-10" 
                    style={{ animation: 'messyWipeOut 8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                  >
                    <div className="absolute top-2 left-2 w-16 h-16 bg-yellow-200/50 rounded-full blur-md"></div>
                    <div className="absolute bottom-4 right-2 w-24 h-12 bg-blue-200/40 rotate-12 blur-sm"></div>
                    <div className="absolute top-10 right-4 w-12 h-12 bg-green-200/30 rotate-45"></div>
                    <div className="absolute bottom-10 left-4 w-8 h-8 bg-purple-200/40 rounded-full blur-[2px]"></div>
                    <span className="absolute top-2 left-2 bg-slate-800/60 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm backdrop-blur-sm">Sua Foto</span>
                  </div>

                  {/* The Product (Lamp) */}
                  <div 
                    className="absolute z-20 flex flex-col items-center translate-y-3 scale-110 transition-all duration-300"
                    style={{ animation: 'lampPolish 8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                  >
                    <div className="w-16 h-10 bg-slate-400 rounded-t-2xl shadow-sm" style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }}></div>
                    <div className="w-1.5 h-12 bg-slate-500"></div>
                    <div className="w-10 h-2 bg-slate-600 rounded-t-sm"></div>
                    <div className="w-20 h-1 bg-slate-900/20 rounded-[100%] mt-1 blur-[3px]"></div>
                  </div>

                  {/* Scanning Line */}
                  <div 
                    className="absolute left-0 w-full h-[3px] bg-primary shadow-[0_0_12px_3px_rgba(var(--primary),0.6)] z-30 pointer-events-none" 
                    style={{ animation: 'aiScanLine 8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                  ></div>
                </div>

                <div className="w-full md:w-[65%] flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[24px] mt-0.5 shrink-0">auto_awesome</span>
                  <div className="text-[13px] sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                    <p className="font-bold text-primary mb-2 text-base">A mágica acontece:</p>
                    <ul className="list-disc list-inside space-y-2 ml-1">
                      <li>Nossa Inteligência Artificial recorta <strong>apenas</strong> o seu produto com precisão milimétrica.</li>
                      <li>Todo o fundo bagunçado, sombras erradas ou detalhes indesejados são removidos.</li>
                      <li>O produto é inserido em um fundo de estúdio infinito e profissional.</li>
                      <li>Sua foto sai pronta para ir direto para o seu catálogo ou Instagram!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2 block">star</span>
              <p className="text-on-surface-variant text-sm">Mais tutoriais interativos chegarão em breve!</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
