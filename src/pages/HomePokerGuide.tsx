import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spade, ArrowLeft, CheckCircle2 } from "lucide-react";

const BASE_URL = "https://cashgamepro.lovable.app";
const PATH = "/guides/home-poker-management";
const TITLE = "Como organizar um cash game de poker em casa | Cash Game Pro";
const DESCRIPTION =
  "Guia completo para organizar um cash game de poker em casa: controle de buy-ins, rake, fichas e pagamentos com organização profissional.";

const faq = [
  {
    q: "Como controlar os buy-ins de cada jogador?",
    a: "Registre cada entrada (buy-in) e recompra (rebuy) por jogador assim que acontece. Anotar o horário e o valor evita discussões no fechamento e mantém o total de fichas em mesa sempre conferido contra o dinheiro recebido.",
  },
  {
    q: "O que é rake e como calcular em um jogo caseiro?",
    a: "Rake é a taxa retirada para cobrir custos da partida (local, fichas, comida). O mais comum em jogos caseiros é uma taxa fixa por jogador ou um percentual pequeno sobre o total movimentado. Defina a regra antes de começar e deixe-a visível para todos.",
  },
  {
    q: "Como fechar as contas no final da noite?",
    a: "Some o valor das fichas de cada jogador, subtraia o que ele colocou (buy-ins) e o resultado é o lucro ou prejuízo. A soma dos resultados de todos os jogadores, menos o rake, deve fechar em zero. Se não fechar, há fichas ou registros faltando.",
  },
  {
    q: "Como evitar erros e desentendimentos sobre o dinheiro?",
    a: "Use um único responsável pelo caixa, registre tudo em tempo real e gere um comprovante por jogador no fechamento. Transparência nos números é o que mantém a mesa saudável e os jogadores voltando.",
  },
];

const HomePokerGuide = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${BASE_URL}${PATH}`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${BASE_URL}${PATH}`} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Como organizar um cash game de poker em casa",
            description: DESCRIPTION,
            author: { "@type": "Organization", name: "Cash Game Pro" },
            publisher: { "@type": "Organization", name: "Cash Game Pro" },
            mainEntityOfPage: `${BASE_URL}${PATH}`,
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          })}
        </script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-green">
            <Spade className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg leading-tight text-poker-gold">Cash Game Pro</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <article className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-display text-poker-gold leading-tight">
              Como organizar um cash game de poker em casa
            </h1>
            <p className="text-muted-foreground">
              Um guia prático para quem quer rodar partidas de poker caseiras com
              organização profissional: controle de buy-ins, rake, fichas e
              pagamentos sem confusão no fechamento.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-2xl text-poker-gold">1. Antes da partida: defina as regras</h2>
            <p className="text-muted-foreground">
              Toda partida bem-sucedida começa com regras claras combinadas antes da
              primeira mão. Defina o valor do buy-in mínimo e máximo, o blind da mesa,
              a política de recompras (rebuys) e, principalmente, como será cobrado o
              rake. Deixar issó decidido evita discussões justamente no momento mais
              sensível: o acerto de contas.
            </p>
            <ul className="space-y-2">
              {[
                "Valor de buy-in e limite de recompras",
                "Blinds e formato (No-Limit, Pot-Limit)",
                "Modelo de rake (taxa fixa ou percentual)",
                "Horário de encerramento e regra de saída antecipada",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl text-poker-gold">2. Controle de buy-ins e recompras</h2>
            <p className="text-muted-foreground">
              O erro mais comum em jogos caseiros é perder o controle de quem colocou
              quanto. Registre cada buy-in e cada rebuy no momento em que acontece,
              identificando o jogador e o valor. Assim, o total de fichas em mesa
              sempre corresponde ao dinheiro recebido no caixa — a base de qualquer
              fechamento correto.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl text-poker-gold">3. Como funciona o rake</h2>
            <p className="text-muted-foreground">
              O rake é a taxa retirada para cobrir os custos de organizar a partida.
              Em jogos caseiros, o modelo mais justo costuma ser uma taxa fixa por
              jogador ou um percentual pequeno sobre o total movimentado. Calcule e
              comunique o rake de forma transparente: os jogadores precisam saber
              exatamente quanto está saindo do bolo e por quê.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl text-poker-gold">4. Fechamento e pagamentos</h2>
            <p className="text-muted-foreground">
              No fim da noite, conte as fichas de cada jogador, subtraia o total de
              buy-ins dele e você terá o resultado (lucro ou prejuízo). A soma de
              todos os resultados, descontado o rake, deve fechar em zero. Se não
              fechar, falta registrar fichas ou algum buy-in. Gere um comprovante por
              jogador para encerrar a noite com total transparência.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl text-poker-gold">Perguntas frequentes</h2>
            <div className="space-y-4">
              {faq.map((f) => (
                <Card key={f.q} className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-medium text-foreground">{f.q}</h3>
                    <p className="text-sm text-muted-foreground">{f.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-6 space-y-4 text-center">
              <h2 className="text-2xl text-poker-gold">Organize tudo issó automaticamente</h2>
              <p className="text-muted-foreground">
                O Cash Game Pro controla buy-ins, rake, fichas e pagamentos em tempo
                real e gera o fechamento de cada jogador para você. Pare de anotar em
                papel e rode suas partidas como um profissional.
              </p>
              <Button asChild size="lg" className="font-display glow-green">
                <Link to="/login">Começar agora</Link>
              </Button>
            </CardContent>
          </Card>

          <div>
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link to="/login">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para o Cash Game Pro
              </Link>
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
};

export default HomePokerGuide;
