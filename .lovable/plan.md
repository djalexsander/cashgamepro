

# 🎰 Poker Cash Game Manager - Plano de Implementação

## Fase 1: Fundação e Layout Base
- Tema escuro estilo Poker Pro com cores verde/dourado
- Layout responsivo com botões grandes para uso rápido
- Navegação principal: Dashboard, Cash Games, Jogadores, Histórico
- Configuração PWA (instalável como app no celular)

## Fase 2: Banco de Jogadores
- Cadastro completo: nome, apelido, telefone, Pix, observações
- Lista pesquisável com filtros
- Perfil individual com histórico acumulado (ganhos/perdas, sessões)
- Editar, excluir e adicionar tags (ex: "VIP", "caloteiro")

## Fase 3: Criar e Gerenciar Cash Game
- Formulário para nova sessão: nome, tipo de jogo, blinds, valor da ficha, rake %, cap de rake
- Dashboard em tempo real: jogadores ativos, fichas na mesa, rake acumulado, maior stack
- Adicionar jogadores (buscar cadastrado ou criar novo na hora)
- Buy-in inicial, horário automático, forma de pagamento

## Fase 4: Controle de Fichas e Movimentações
- Botões rápidos por jogador: Add Fichas, Remover, Rebuy, Ver Relatório
- Histórico detalhado de cada ação com horário
- Cálculo automático de rake por movimentação
- Total investido atualizado em tempo real

## Fase 5: Fechamento e Relatórios
- Fechar conta individual: fichas finais → cálculo automático de lucro/prejuízo
- Status de pagamento: Pago, Pendente, Recebido
- Encerrar Cash Game: relatório geral completo
- Exportação PDF (individual e geral) e CSV

## Fase 6: Funcionalidades Extras
- Ranking de lucratividade entre jogadores
- Histórico geral filtrável por data
- Gráficos de evolução por jogador (Recharts)
- Proteção por senha de administrador

## Armazenamento
- **IndexedDB local** para funcionamento offline completo
- **Supabase Cloud** para backup e sincronização quando online
- Tabelas: `cash_sessions`, `players`, `cash_players`, `transactions`, `payments`, `rake_log`

