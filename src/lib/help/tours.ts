// ============================================================
// Contextual help tours — a short, dismissible walkthrough per screen.
// Not tied to DEMO_MODE: this is a plain product feature (no WhatsApp/
// Meta calls involved), safe to ship to production as-is.
//
// Two kinds of step:
//   - AnchorStep   — highlights one real element on screen (a form,
//                    a button, a panel) and explains it.
//   - SummaryStep  — the tour's closing step. No element highlight;
//                    a larger, centered recap card listing what the
//                    screen makes possible, framed as business value
//                    ("o que você pode configurar/ganhar aqui") rather
//                    than a restatement of the anchor steps.
//
// Every registered tour should end with exactly one SummaryStep.
// ============================================================

export interface AnchorStep {
  kind?: "anchor";
  selector: string;
  title: string;
  body: string;
}

export interface SummaryBullet {
  label: string;
  detail: string;
}

export interface SummaryStep {
  kind: "summary";
  title: string;
  intro: string;
  bullets: SummaryBullet[];
}

export type TourStep = AnchorStep | SummaryStep;

export const TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      selector: '[data-tour="dashboard-metrics"]',
      title: "Métricas do dia",
      body: "Conversas ativas, novos contatos, valor em aberto no pipeline e mensagens enviadas hoje — comparado com ontem. Atualiza sozinho, sem planilha.",
    },
    {
      selector: '[data-tour="dashboard-quick-actions"]',
      title: "Ações rápidas",
      body: "Atalhos para as tarefas mais comuns: criar contato, deal, broadcast ou automação sem sair do dashboard.",
    },
    {
      selector: '[data-tour="dashboard-conversations-chart"]',
      title: "Conversas ao longo do tempo",
      body: "Volume de mensagens recebidas e enviadas por dia. Ajuda a ver o efeito de uma campanha de reativação no engajamento.",
    },
    {
      selector: '[data-tour="dashboard-pipeline-chart"]',
      title: "Valor em pipeline",
      body: "Quanto está parado em cada estágio do funil de vendas agora — Novo lead, Em negociação, Recuperado, etc.",
    },
    {
      kind: "summary",
      title: "O que este painel resolve",
      intro: "Uma visão de comando do negócio inteiro, sem precisar abrir planilha nem perguntar pro time.",
      bullets: [
        { label: "Saúde do atendimento", detail: "Quantas conversas estão em aberto agora e quantas mensagens saíram hoje." },
        { label: "Aquisição", detail: "Quantos contatos novos chegaram hoje vs. ontem — mede se as campanhas estão trazendo gente." },
        { label: "Receita em risco/oportunidade", detail: "Valor total parado no funil de vendas, por estágio." },
        { label: "Tendência", detail: "Gráfico de 7/30/90 dias mostra se o volume de conversas está subindo ou caindo." },
      ],
    },
  ],

  "/inbox": [
    {
      selector: '[data-tour="inbox-conversation-list"]',
      title: "Inbox compartilhada",
      body: "Toda conversa do WhatsApp da conta, em um só lugar. Vários atendentes podem trabalhar no mesmo número sem se atropelar.",
    },
    {
      selector: '[data-tour="inbox-contact-sidebar"]',
      title: "Tags e dados do contato",
      body: 'Tags como "ativo" ou "inativo 60+ dias" ficam aqui — é o gatilho que as automações usam para decidir quem reengajar. Dá pra adicionar/remover na hora.',
    },
    {
      selector: '[data-tour="inbox-status-assign"]',
      title: "Status e atribuição",
      body: "Marque a conversa como aberta/pendente/fechada, e atribua a um atendente específico do time — é o que dispara a notificação dele.",
    },
    {
      selector: '[data-tour="inbox-composer"]',
      title: "Responder — texto, mídia, template ou botões",
      body: "O clipe anexa mídia, o raio abre os templates aprovados pela Meta, e o ✨ pede um rascunho de resposta pra IA revisar antes de enviar.",
    },
    {
      selector: 'button[aria-label="Simulate reply"]',
      title: "Simular resposta (só na demo)",
      body: "Injeta uma resposta falsa do contato agora mesmo, pelo mesmo caminho que uma mensagem real do WhatsApp usaria — ótimo para mostrar automações ao vivo.",
    },
    {
      selector: 'button[aria-label="Trigger reactivation"]',
      title: "Disparar reativação (só na demo)",
      body: 'Marca o contato como "inativo 60+ dias" e dispara a automação de reativação na hora — sem esperar o processo real acontecer.',
    },
    {
      kind: "summary",
      title: "O que a inbox resolve",
      intro: "Substitui o WhatsApp Business sozinho no celular de uma pessoa por um atendimento de time, rastreável e sem número banido.",
      bullets: [
        { label: "Vários atendentes, um número só", detail: "Sem passar o celular de mão em mão nem duplicar o WhatsApp." },
        { label: "Contexto completo por contato", detail: "Tags, histórico e notas — ninguém começa a conversa do zero." },
        { label: "Handoff automático", detail: "Atribuição de conversa notifica o atendente certo na hora." },
        { label: "Resposta assistida por IA", detail: "Rascunho automático de resposta, revisado por um humano antes de enviar." },
      ],
    },
  ],

  "/pipelines": [
    {
      selector: '[data-tour="pipeline-analytics"]',
      title: "Resumo do funil",
      body: "Total de deals, valor total, ticket médio, valor ponderado, ganhos e perdidos no mês — tudo calculado automaticamente.",
    },
    {
      selector: '[data-tour="pipeline-board"]',
      title: "Kanban de vendas",
      body: "Arraste um card para mudar de estágio. Cada rifa vendida é um deal com valor — dá para ver o dinheiro se movendo pelo funil.",
    },
    {
      selector: '[data-tour="pipeline-add-deal"]',
      title: "Criar deal / novo funil",
      body: "Cadastre uma venda manualmente vinculada a um contato, ou crie um funil paralelo (ex: um funil por tipo de rifa).",
    },
    {
      kind: "summary",
      title: "O que o pipeline resolve",
      intro: "Transforma \"vendi uma rifa pra fulano\" em um número que o negócio consegue acompanhar e projetar.",
      bullets: [
        { label: "Funil configurável", detail: "Estágios do jeito que o negócio realmente funciona — Novo lead até Recuperado/Perdido." },
        { label: "Valor real em cada etapa", detail: "Quanto dinheiro está em negociação, quanto já foi ganho, quanto foi perdido." },
        { label: "Ligado à conversa", detail: "Cada deal aponta para o contato e a conversa de origem — rastreabilidade de ponta a ponta." },
      ],
    },
  ],

  "/broadcasts": [
    {
      selector: '[data-tour="broadcasts-new"]',
      title: "Novo broadcast",
      body: "Assistente de 4 passos: escolhe o template aprovado, filtra o público por tag, revisa e agenda — sem precisar de desenvolvedor.",
    },
    {
      selector: '[data-tour="broadcasts-table"]',
      title: "Histórico de campanhas",
      body: "Cada linha é um disparo em massa: quantos receberam, % de entrega e % de leitura. É a prova de resultado de cada campanha de reativação.",
    },
    {
      kind: "summary",
      title: "O que os broadcasts resolvem",
      intro: "É o \"disparo em massa\" que hoje provavelmente é feito na mão, mensagem por mensagem, arriscando o número ser banido.",
      bullets: [
        { label: "Segmentação por tag", detail: "Manda só para quem interessa — ex: só \"inativo 60+ dias\"." },
        { label: "Templates pré-aprovados", detail: "Usa os mesmos templates homologados pela Meta, sem risco de bloqueio." },
        { label: "Resultado mensurável", detail: "% de entrega e leitura por campanha, para comparar o que funciona." },
      ],
    },
  ],

  "/automations": [
    {
      selector: '[data-tour="automations-create"]',
      title: "Criar automação",
      body: "Builder visual: gatilho → condição → ação. Sem código — quem administra a conta consegue montar sozinho.",
    },
    {
      selector: '[data-tour="automations-list"]',
      title: "Automações ativas",
      body: "O interruptor liga/desliga cada automação. O contador de execuções mostra quantas vezes ela já rodou de verdade.",
    },
    {
      kind: "summary",
      title: "O que as automações resolvem",
      intro: "É a peça que substitui o trabalho manual de \"lembrar de mandar mensagem pra quem sumiu\" — o sistema reage sozinho ao comportamento do contato.",
      bullets: [
        { label: "Gatilhos reais", detail: "Tag adicionada, mensagem recebida, contato novo, palavra-chave, resposta a botão." },
        { label: "Condições", detail: "Só executa se a tag ainda estiver presente, se o campo for X, se for dentro de um horário, etc." },
        { label: "Ações encadeadas", detail: "Enviar template, marcar/desmarcar tag, atribuir conversa, criar deal, esperar, chamar um webhook externo." },
        { label: "Zero-toque no dia a dia", detail: "Uma vez configurada, roda sem que ninguém precise lembrar de nada." },
      ],
    },
  ],

  "/automations/new": [
    {
      selector: '[data-tour="automation-name"]',
      title: "Nome e gatilho",
      body: "Dê um nome claro e escolha o que dispara essa automação — desde uma tag adicionada até uma mensagem com uma palavra específica.",
    },
    {
      selector: '[data-tour="automation-canvas"]',
      title: "Monte a sequência de ações",
      body: "Arraste passos como enviar template, aguardar, verificar uma condição e ramificar em sim/não. É visual — sem escrever código.",
    },
    {
      selector: '[data-tour="automation-save"]',
      title: "Ativar",
      body: "Salve e ligue o interruptor — a automação já passa a reagir a eventos reais na hora.",
    },
    {
      kind: "summary",
      title: "O que dá para construir aqui",
      intro: "Qualquer fluxo de \"se isso, então aquilo\" que hoje depende de alguém lembrar de fazer na mão.",
      bullets: [
        { label: "Reativação", detail: "Contato marcado como inativo → recebe oferta automaticamente." },
        { label: "Boas-vindas", detail: "Primeiro contato → mensagem de apresentação automática." },
        { label: "Qualificação", detail: "Pergunta automática pra entender o que o lead quer antes de um humano entrar." },
        { label: "Recuperação", detail: "Cliente responde → tag removida, conversa atribuída, atendente notificado." },
      ],
    },
  ],

  "/broadcasts/new": [
    {
      selector: '[data-tour="broadcast-wizard-steps"]',
      title: "Assistente de 4 passos",
      body: "Template → público → variáveis → revisão e agendamento. Cada passo valida antes de deixar avançar, então é difícil errar.",
    },
    {
      kind: "summary",
      title: "O que este assistente resolve",
      intro: "Dispara pra centenas de contatos filtrados por tag, no template certo, sem precisar copiar e colar mensagem por mensagem.",
      bullets: [
        { label: "Público certo", detail: "Filtra por tag antes de disparar — evita mandar oferta de reativação pra quem já comprou hoje." },
        { label: "Agendamento", detail: "Pode mandar agora ou programar pra um horário melhor." },
        { label: "Sem risco de ban", detail: "Usa a API oficial + templates aprovados, não automação não-oficial." },
      ],
    },
  ],

  "/settings": [
    {
      selector: 'nav[aria-label="Settings sections"]',
      title: "Tudo em um só lugar",
      body: "Conta, WhatsApp, templates, tags, moeda, time e chaves de API — cada seção fica aqui.",
    },
    {
      selector: '[data-tour="settings-whatsapp"]',
      title: "Conexão com o WhatsApp",
      body: "Mostra se o número está conectado agora. No dia da virada para produção, é aqui que entram as credenciais reais da Meta.",
    },
    {
      selector: '[data-tour="settings-templates"]',
      title: "Templates de mensagem",
      body: "Quantos templates existem e o status deles junto à Meta (aprovado/pendente/rejeitado).",
    },
    {
      selector: '[data-tour="settings-members"]',
      title: "Time e permissões",
      body: "Convide atendentes por link, com papéis diferentes: dono, admin, atendente ou apenas leitura.",
    },
    {
      kind: "summary",
      title: "O que dá para configurar aqui",
      intro: "Cada engrenagem do sistema, num único painel — sem precisar mexer em código ou pedir pra um desenvolvedor.",
      bullets: [
        { label: "Conexão com a Meta", detail: "Phone Number ID, WABA ID e token — a diferença entre demo e produção." },
        { label: "Catálogo de templates", detail: "Criar, editar, sincronizar e acompanhar aprovação dos templates." },
        { label: "Tags e campos", detail: "Vocabulário do negócio — segmentações como \"inativo 60+ dias\"." },
        { label: "Time", detail: "Múltiplos atendentes com papéis e permissões diferentes." },
        { label: "Moeda e API", detail: "Moeda padrão do pipeline e chaves para integrações externas." },
      ],
    },
  ],

  "/settings?tab=whatsapp": [
    {
      selector: '[data-tour="whatsapp-form"]',
      title: "Credenciais da Meta",
      body: "Phone Number ID, WhatsApp Business Account ID e o token de acesso — os três dados que vêm do Meta for Developers.",
    },
    {
      selector: '[data-tour="whatsapp-status"]',
      title: "Status da conexão",
      body: "Confirma que a Meta aceitou as credenciais e que o número está pronto para enviar e receber mensagens.",
    },
    {
      kind: "summary",
      title: "O que muda ao preencher isso de verdade",
      intro: "Este é o único passo entre a conta demo que você está vendo agora e o número real do cliente enviando mensagens de verdade.",
      bullets: [
        { label: "Sem código", detail: "Colar as 3 credenciais aqui já troca de simulado para real." },
        { label: "Verificação automática", detail: "O sistema testa as credenciais com a Meta antes de salvar." },
        { label: "Registro do webhook", detail: "Um clique em \"Verify Registration\" confirma que mensagens recebidas chegam aqui." },
      ],
    },
  ],

  "/agents": [
    {
      selector: '[data-tour="agent-provider-key"]',
      title: "Traga sua própria chave de IA",
      body: "OpenAI ou Anthropic — a chave fica criptografada, sem taxa por atendente e sem seus dados passando por terceiros além do provedor escolhido.",
    },
    {
      selector: '[data-tour="agent-behaviour"]',
      title: "Contexto do negócio",
      body: "Descreva o negócio, o tom de voz e o que a IA nunca deve prometer — isso alimenta tanto o rascunho de resposta quanto o auto-reply.",
    },
    {
      selector: '[data-tour="agent-playground-tab"]',
      title: "Playground",
      body: "Teste a IA com perguntas reais de cliente antes de ativar — sem gastar crédito de verdade em produção.",
    },
    {
      kind: "summary",
      title: "O que o agente de IA resolve",
      intro: "Tira do atendente humano a resposta repetitiva, mantendo ele no controle da conversa.",
      bullets: [
        { label: "Rascunho assistido", detail: "IA sugere a resposta, o atendente revisa e envia — nunca manda nada sozinha por padrão." },
        { label: "Auto-reply opcional", detail: "Pode responder sozinha até um limite por conversa, com handoff limpo pro humano." },
        { label: "Base de conhecimento", detail: "Alimente com FAQs e políticas — a IA responde a partir do conteúdo real do negócio." },
      ],
    },
  ],
};

/**
 * Resolve the tour steps for the current route. Tries an exact
 * `pathname?query` key first (used by /settings, whose sub-sections
 * are query-param tabs on one route), then exact pathname, then the
 * longest registered prefix (so a dynamic route like
 * `/automations/<id>/edit` still falls back to the `/automations` tour).
 */
export function toursForPath(pathname: string, search?: string): TourStep[] | null {
  if (search) {
    const combined = `${pathname}${search}`;
    if (TOURS[combined]) return TOURS[combined];
  }
  if (TOURS[pathname]) return TOURS[pathname];
  const candidates = Object.keys(TOURS).filter(
    (p) => !p.includes("?") && pathname.startsWith(p),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return TOURS[candidates[0]];
}
