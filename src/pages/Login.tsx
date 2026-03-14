import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spade, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const Login = () => {
  const { signIn, signUp, session, isLoading, isInactive } = useAuth();
  const navigate = useNavigate();
  const savedEmail = localStorage.getItem("poker_remember_email") || "";
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!savedEmail);

  // If already logged in, redirect to dashboard
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
        // Save or clear remembered email
        if (rememberMe) {
          localStorage.setItem("poker_remember_email", email);
        } else {
          localStorage.removeItem("poker_remember_email");
        }
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 500);
      }
    } catch {
      toast({ title: "Erro inesperado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-poker-felt opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background to-transparent" />

      <Card className="relative z-10 w-full max-w-sm bg-card/90 backdrop-blur-sm border-border shadow-2xl">
        <CardContent className="p-8 space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center glow-green">
              <Spade className="w-9 h-9 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl text-poker-gold">Poker Manager</h1>
              <p className="text-xs text-muted-foreground font-sans normal-case tracking-normal mt-1">
                Cash Game Pro
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
                Email
              </label>
              <Input
                type="email"
                placeholder="seu@email.com"
                className="bg-muted border-border h-12"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
                Senha
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
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

            {!isSignUp && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground font-sans normal-case tracking-normal cursor-pointer">
                  Lembrar meu email
                </label>
              </div>
            )}


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
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
