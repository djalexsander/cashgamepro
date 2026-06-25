import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spade, Loader2, Eye, EyeOff, AlertTriangle, ArrowLeft, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import Seo from "@/components/Seo";

type ViewMode = "login" | "forgot";

const Login = () => {
  const { signIn, signUp, session, isLoading, isInactive, isSubscriptionBlocked } = useAuth();
  const navigate = useNavigate();
  const savedEmail = localStorage.getItem("poker_remember_email") || "";
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!savedEmail);
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [resetSent, setResetSent] = useState(false);

  if (!isLoading && session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);
      if (error) {
        toast({
          title: isSignUp ? "Erro ao cadastrar" : "Erro ao entrar",
          description: error.message,
          variant: "destructive",
        });
      } else if (isSignUp) {
        toast({ title: "Conta criada!", description: "Verifique seu email para confirmar." });
      } else {
        if (rememberMe) {
          localStorage.setItem("poker_remember_email", email);
        } else {
          localStorage.removeItem("poker_remember_email");
        }
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 500);
      }
    } catch (error) {
      console.error("[login] error", error);
      toast({
        title: isSignUp ? "Falha ao cadastrar" : "Falha ao entrar",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a autenticação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Informe seu email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setResetSent(true);
        toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada." });
      }
    } catch (error) {
      console.error("[password-reset] error", error);
      toast({
        title: "Falha ao enviar recuperação",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o email de recuperação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <Seo
        title="Entrar — Cash Game Pro"
        description="Acesse o Cash Game Pro para gerenciar suas partidas de poker, controlar buy-ins, rake e pagamentos."
        path="/login"
      />
      <div className="absolute inset-0 bg-poker-felt opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background to-transparent" />

      <Card className="relative z-10 w-full max-w-sm bg-card/90 backdrop-blur-sm border-border shadow-2xl">
        <CardContent className="p-8 space-y-8">
          {/* Subscription blocked notification */}
          {isSubscriptionBlocked && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive font-sans normal-case tracking-normal">
                  Acesso bloqueado por inadimplência
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-sans normal-case tracking-normal">
                  Sua mensalidade está vencida. Entre em contato com o administrador para regularizar seu acesso.
                </p>
              </div>
            </div>
          )}

          {isInactive && !isSubscriptionBlocked && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive font-sans normal-case tracking-normal">
                  Conta desativada
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-sans normal-case tracking-normal">
                  Sua conta foi desativada pelo administrador.
                </p>
              </div>
            </div>
          )}

          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center glow-green">
              <Spade className="w-9 h-9 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl text-poker-gold">Cash Game Pro</h1>
              <p className="text-xs text-muted-foreground font-sans normal-case tracking-normal mt-1">
                Cash Game Pro
              </p>
            </div>
          </div>

          {viewMode === "forgot" ? (
            /* Forgot Password View */
            <div className="space-y-4">
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-sans normal-case tracking-normal"
                onClick={() => { setViewMode("login"); setResetSent(false); }}
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </button>

              {resetSent ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold font-sans normal-case tracking-normal">
                    Email enviado!
                  </h3>
                  <p className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
                    Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setResetSent(false); }}
                  >
                    Reenviar email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <h3 className="text-lg font-semibold text-center font-sans normal-case tracking-normal">
                    Recuperar senha
                  </h3>
                  <p className="text-sm text-muted-foreground text-center font-sans normal-case tracking-normal">
                    Informe seu email para receber o link de recuperação.
                  </p>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    className="bg-muted border-border h-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                  <Button type="submit" className="w-full h-12 text-base font-display" disabled={loading}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar link de recuperação"}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            /* Login/SignUp View */
            <>
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <label htmlFor="login-email" className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
                    Email
                  </label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className="bg-muted border-border h-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
                    Senha
                  </label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="bg-muted border-border h-12 pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {!isSignUp && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                      />
                      <label htmlFor="remember" className="text-sm text-muted-foreground font-sans normal-case tracking-normal cursor-pointer">
                        Lembrar email
                      </label>
                    </div>
                  )}
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:text-primary/80 transition-colors font-sans normal-case tracking-normal"
                      onClick={() => setViewMode("forgot")}
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-base font-display" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isSignUp ? (
                    "Criar Conta"
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-poker-gold transition-colors font-sans normal-case tracking-normal"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
