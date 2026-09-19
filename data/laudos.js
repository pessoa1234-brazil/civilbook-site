// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Modelos de laudos e documentos técnicos. Campos entre [COLCHETES] devem ser preenchidos.
const LAUDOS = [
  {
    id: "vistoria-estrutural",
    titulo: "Laudo de vistoria estrutural",
    sub: "Avaliação de edificação existente",
    icone: "ti-building",
    corpo: `LAUDO DE VISTORIA ESTRUTURAL

1. IDENTIFICAÇÃO
Solicitante: [NOME / CNPJ-CPF]
Endereço do imóvel: [ENDEREÇO COMPLETO]
Responsável técnico: [NOME] — CREA/CAU [Nº]
ART/RRT nº: [NÚMERO]
Data da vistoria: [DATA]

2. OBJETIVO
Avaliar as condições de estabilidade e segurança estrutural da edificação, identificando manifestações patológicas e seu grau de risco, conforme inspeção visual e ensaios [INDICAR SE HOUVE].

3. DESCRIÇÃO DA EDIFICAÇÃO
Tipologia: [RESIDENCIAL/COMERCIAL], [Nº] pavimentos
Sistema estrutural: [CONCRETO ARMADO / ALVENARIA ESTRUTURAL / METÁLICA]
Idade aproximada: [ANOS]
Documentação disponível: [PROJETOS / NENHUMA]

4. METODOLOGIA
Inspeção visual sistemática conforme diretrizes da NBR 16747 (inspeção predial), com registro fotográfico e mapeamento de anomalias. [DESCREVER ENSAIOS COMPLEMENTARES: esclerometria, pacometria, extração de testemunhos etc.]

5. ANOMALIAS CONSTATADAS
5.1 [LOCAL]: [DESCRIÇÃO — ex.: fissura inclinada 45°, abertura ~2 mm, em alvenaria do pav. térreo]
    Causa provável: [RECALQUE / SOBRECARGA / TÉRMICA / RETRAÇÃO]
    Grau de risco: [CRÍTICO / REGULAR / MÍNIMO]
5.2 [REPETIR PARA CADA ANOMALIA]

6. CLASSIFICAÇÃO E PRIORIZAÇÃO
[TABELA: anomalia × grau de risco × prazo recomendado de intervenção]

7. CONCLUSÃO
A edificação encontra-se em condições [SATISFATÓRIAS / SATISFATÓRIAS COM RESSALVAS / INSATISFATÓRIAS] de estabilidade.
Recomendações: [LISTAR INTERVENÇÕES E PRAZOS]

8. ENCERRAMENTO
Este laudo reflete as condições observáveis na data da vistoria.

[CIDADE], [DATA]

_________________________________
[NOME]
Responsável técnico — CREA/CAU [Nº]`
  },
  {
    id: "patologia-fissuras",
    titulo: "Laudo de patologia — fissuras",
    sub: "Manifestações em alvenaria e concreto",
    icone: "ti-line-dashed",
    corpo: `LAUDO TÉCNICO — ANÁLISE DE FISSURAS

1. IDENTIFICAÇÃO
Solicitante: [NOME]
Imóvel: [ENDEREÇO]
Responsável técnico: [NOME] — CREA/CAU [Nº] · ART/RRT [Nº]
Data: [DATA]

2. CARACTERIZAÇÃO DAS FISSURAS
Para cada ocorrência, registrar:
- Localização (pavimento, cômodo, elemento)
- Geometria: [HORIZONTAL / VERTICAL / INCLINADA ~45° / MAPEADA]
- Abertura medida com fissurômetro: [mm]
- Atividade: [ATIVA / PASSIVA] (instalar selos de gesso ou monitorar com fissurômetro por [PERÍODO])

3. DIAGNÓSTICO — CORRELAÇÃO TÍPICA
- Inclinadas ~45° partindo de aberturas: recalque diferencial de fundação
- Horizontais no topo da parede: dilatação térmica de laje/cobertura
- Verticais regulares: retração de argamassa/movimentação higroscópica
- Mapeadas (tipo craquelê): retração de revestimento
- Em vãos sem verga/contraverga: concentração de tensões
Diagnóstico do caso: [DESCREVER]

4. GRAU DE RISCO
[MÍNIMO — estético / REGULAR — funcional / CRÍTICO — compromete segurança]

5. RECOMENDAÇÕES DE RECUPERAÇÃO
[Ex.: monitoramento 90 dias; tratamento com selante PU para fissuras passivas até 1 mm; grampeamento + tela para ativas; reforço de fundação se recalque progressivo]

6. CONCLUSÃO
[SÍNTESE]

[CIDADE], [DATA]

_________________________________
[NOME] — CREA/CAU [Nº]`
  },
  {
    id: "inspecao-fundacoes",
    titulo: "Relatório de inspeção — fundações",
    sub: "Acompanhamento de execução",
    icone: "ti-stack-2",
    corpo: `RELATÓRIO DE INSPEÇÃO DE OBRA — FUNDAÇÕES

Obra: [NOME/ENDEREÇO]
Contratante: [NOME]
Fiscal/RT: [NOME], CREA/CAU [Nº]
Período: [DATA INICIAL] a [DATA FINAL]
Relatório nº: [SEQUENCIAL]

1. SERVIÇOS EXECUTADOS NO PERÍODO
[Ex.: execução de 12 estacas hélice contínua Ø40 cm (E-13 a E-24), profundidade média 14,5 m]

2. CONFORMIDADE COM PROJETO
- Locação conferida: [SIM/NÃO — desvios observados]
- Profundidades atingidas vs. previstas: [TABELA]
- Consumo de concreto: previsto [m³] × real [m³] — sobreconsumo [%]
- Armaduras conforme projeto: [SIM/NÃO]

3. CONTROLE TECNOLÓGICO
- Concreto: fck [MPa], slump medido [mm], CPs moldados [QTD]
- Boletins de perfuração arquivados: [SIM/NÃO]

4. NÃO CONFORMIDADES E TRATATIVAS
[DESCREVER + AÇÃO CORRETIVA + RESPONSÁVEL + PRAZO]

5. REGISTRO FOTOGRÁFICO
[ANEXO]

6. CONCLUSÃO DO PERÍODO
Serviços [CONFORMES / CONFORMES COM RESSALVAS / NÃO CONFORMES].

[CIDADE], [DATA]

_________________________________
[NOME] — CREA/CAU [Nº]`
  },
  {
    id: "diario-obra",
    titulo: "Diário de obra (modelo diário)",
    sub: "Registro diário de atividades",
    icone: "ti-notebook",
    corpo: `DIÁRIO DE OBRA — FOLHA Nº [SEQ]

Obra: [NOME] | Data: [DATA] | Dia da semana: [DIA]
Clima: manhã [BOM/CHUVA] · tarde [BOM/CHUVA]
Condição do canteiro: [OPERACIONAL / PARALISADO — MOTIVO]

EFETIVO
Engenheiro: [QTD] | Mestre: [QTD] | Pedreiro: [QTD]
Servente: [QTD] | Armador: [QTD] | Carpinteiro: [QTD] | Outros: [QTD]
Total: [QTD]

EQUIPAMENTOS EM USO
[Ex.: betoneira 400 L (1), grua (1), vibrador (2)]

SERVIÇOS EXECUTADOS
- [FRENTE 1: descrição e localização]
- [FRENTE 2]

MATERIAIS RECEBIDOS
- [NF, material, quantidade, fornecedor]

OCORRÊNCIAS / NÃO CONFORMIDADES
- [DESCREVER — acidentes, retrabalho, paralisações, visitas]

ORDENS E COMUNICAÇÕES DA FISCALIZAÇÃO
- [REGISTRAR]

___________________            ___________________
Responsável da executora        Fiscalização`
  },
  {
    id: "termo-recebimento",
    titulo: "Termo de recebimento de obra",
    sub: "Provisório ou definitivo",
    icone: "ti-file-certificate",
    corpo: `TERMO DE RECEBIMENTO [PROVISÓRIO/DEFINITIVO] DE OBRA

Contratante: [NOME/CNPJ]
Contratada: [NOME/CNPJ]
Contrato nº: [Nº] | Objeto: [DESCRIÇÃO DA OBRA]
Local: [ENDEREÇO]

1. Na data de [DATA], a comissão designada vistoriou a obra em referência e constatou que os serviços foram executados [INTEGRALMENTE / COM AS PENDÊNCIAS LISTADAS NO ANEXO I] em conformidade com o contrato, projetos e especificações.

2. PENDÊNCIAS (se houver)
[LISTA COM PRAZO DE CORREÇÃO — máx. usual 90 dias para recebimento definitivo]

3. O presente termo não exime a contratada das responsabilidades previstas no art. 618 do Código Civil (garantia quinquenal de solidez e segurança).

4. DOCUMENTOS ENTREGUES
[ ] Projetos as built   [ ] Manual de uso e operação (NBR 15575)
[ ] ART/RRT de execução [ ] CND do INSS da obra
[ ] Habite-se           [ ] Termos de garantia de equipamentos

[CIDADE], [DATA]

___________________     ___________________     ___________________
Contratante              Contratada               Fiscalização`
  },

  // ───────────────── Segurança do Trabalho (e21) — modelos de documentos ─────────────
  {
    id: "os-seguranca",
    titulo: "Ordem de Serviço de Segurança (NR-1)",
    sub: "Cientificação de riscos e medidas por função",
    icone: "ti-clipboard-text",
    corpo: `ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE NO TRABALHO
(NR-1, item 1.4.1 "b")

Empregador: [RAZÃO SOCIAL / CNPJ]
Obra/Setor: [IDENTIFICAÇÃO] | Função: [CARGO]
Trabalhador: [NOME] | CTPS/Matrícula: [Nº]

1. RISCOS DA FUNÇÃO (conforme inventário de riscos do PGR)
- Físicos: [ruído, vibração, calor…]
- Químicos: [poeira/sílica, solventes…]
- Biológicos: [quando aplicável]
- Acidentes/Ergonômicos: [queda, choque, máquinas, posturas…]

2. MEDIDAS DE PREVENÇÃO E PROCEDIMENTOS
- Coletivas: [guarda-corpo, sinalização, isolamento…]
- Administrativas: [PT, capacitação, rodízio…]
- EPI obrigatório: [LISTAR com CA]

3. OBRIGAÇÕES DO TRABALHADOR
Cumprir os procedimentos, usar/conservar o EPI, comunicar condições inseguras e situações de risco grave e iminente.

4. PROIBIÇÕES
[Ex.: improvisar acessos, retirar proteções de máquinas, trabalhar em altura sem proteção.]

Declaro ter recebido orientação sobre os riscos e as medidas de prevenção desta função.

[CIDADE], [DATA]

___________________________      ___________________________
Trabalhador                      Responsável / SESMT`
  },
  {
    id: "apr-ast",
    titulo: "APR / Análise de Risco da Tarefa",
    sub: "Análise Preliminar de Risco (APR/AST)",
    icone: "ti-list-search",
    corpo: `ANÁLISE PRELIMINAR DE RISCO (APR / AST)

Obra: [NOME] | Data: [DATA] | Nº: [SEQ]
Tarefa: [DESCRIÇÃO DA ATIVIDADE]
Local/Frente: [LOCAL] | Equipe: [Nº DE PESSOAS] | Responsável: [NOME]

ETAPAS DA TAREFA × PERIGOS × MEDIDAS DE CONTROLE
1. [Etapa] | Perigo: [ex.: queda de altura] | Controle: [proteção coletiva + EPI + PT]
2. [Etapa] | Perigo: [ex.: choque elétrico]  | Controle: [desenergizar + bloqueio]
3. [Etapa] | Perigo: [...]                    | Controle: [...]

CLASSIFICAÇÃO DO RISCO (após controles): [TRIVIAL / TOLERÁVEL / MODERADO / SUBSTANCIAL / INTOLERÁVEL]
Exige Permissão de Trabalho (PT)? [ ] Sim  [ ] Não

EPI / EPC NECESSÁRIOS: [LISTAR]
CONDIÇÕES PARA INÍCIO: [pré-requisitos atendidos? área isolada? equipe capacitada?]
PLANO DE EMERGÊNCIA/RESGATE: [DESCREVER]

Participantes (li e compreendi a análise):
[NOME — FUNÇÃO — ASSINATURA] (repetir por integrante)

___________________________      ___________________________
Elaboração (responsável)         Técnico/Eng. de Segurança`
  },
  {
    id: "pt-trabalho",
    titulo: "Permissão de Trabalho (PT)",
    sub: "Altura, quente, elétrica ou espaço confinado",
    icone: "ti-file-check",
    corpo: `PERMISSÃO DE TRABALHO (PT)   Nº: [SEQ]

Tipo: [ ] Altura  [ ] Serviço a quente  [ ] Elétrica (energizado)  [ ] Espaço confinado  [ ] Içamento
Obra/Local: [IDENTIFICAÇÃO] | Data: [DATA] | Validade: das [__:__] às [__:__]
Descrição do serviço: [DETALHAR] | APR vinculada nº: [Nº]

PRÉ-REQUISITOS (assinalar antes de liberar)
[ ] Equipe capacitada e apta (ASO)        [ ] EPIs/EPC inspecionados
[ ] Área isolada e sinalizada             [ ] Energias bloqueadas (quando aplicável)
[ ] Atmosfera medida (confinado)          [ ] Ancoragem definida (altura)
[ ] Extintor próximo (serviço a quente)   [ ] Plano de resgate disponível

MEDIÇÕES (espaço confinado): O₂ [__%] | Inflamáveis [__% LIE] | Tóxicos [__ ppm]

LIBERAÇÃO
Emitente: [NOME/FUNÇÃO] — [ASSINATURA]
Executante responsável: [NOME] — [ASSINATURA]
Vigia (quando exigido): [NOME] — [ASSINATURA]

ENCERRAMENTO: serviço concluído / área liberada em [DATA/HORA].
___________________________      ___________________________
Emitente                         Executante`
  },
  {
    id: "ficha-epi",
    titulo: "Ficha de Controle de Entrega de EPI (NR-6)",
    sub: "Registro de fornecimento e troca",
    icone: "ti-helmet",
    corpo: `FICHA DE CONTROLE DE ENTREGA DE EPI
(NR-6)

Empregador: [RAZÃO SOCIAL / CNPJ] | Obra: [IDENTIFICAÇÃO]
Trabalhador: [NOME] | Função: [CARGO] | Matrícula/CTPS: [Nº] | Admissão: [DATA]

Declaro ter recebido gratuitamente os EPIs abaixo, treinamento sobre o uso, guarda e
conservação, e comprometo-me a usá-los durante a jornada, comunicando qualquer dano ou extravio.

DATA | EPI / DESCRIÇÃO | CA Nº | QTD | MOTIVO (entrega/troca) | ASSINATURA
[__/__/__] | [Capacete] | [____] | [1] | [Entrega] | __________
[__/__/__] | [Calçado de segurança] | [____] | [1] | [Entrega] | __________
[__/__/__] | [Óculos] | [____] | [1] | [Entrega] | __________
[__/__/__] | [Luvas] | [____] | [__] | [Troca] | __________
[__/__/__] | [...] | [____] | [__] | [...] | __________

Orientações: o uso do EPI é obrigatório nas atividades de risco; a recusa injustificada
constitui ato faltoso (CLT art. 158). A higienização e a substituição são responsabilidade do empregador.

___________________________      ___________________________
Trabalhador                      Responsável pela entrega`
  },
  {
    id: "pgr-construcao",
    titulo: "PGR da construção — estrutura (NR-1/NR-18)",
    sub: "Roteiro do Programa de Gerenciamento de Riscos",
    icone: "ti-folder-cog",
    corpo: `PROGRAMA DE GERENCIAMENTO DE RISCOS (PGR) — CONSTRUÇÃO
(NR-1 e NR-18)

Empresa: [RAZÃO SOCIAL / CNPJ] | Obra: [IDENTIFICAÇÃO / ENDEREÇO]
Responsável técnico (segurança): [NOME — formação — registro]
Vigência: [DATA] | Revisão: [Nº/DATA]

1. CARACTERIZAÇÃO DA OBRA E DOS PROCESSOS
[Tipo de obra, etapas, efetivo previsto, frentes de serviço]

2. INVENTÁRIO DE RISCOS (por função/atividade)
FUNÇÃO/ATIVIDADE | PERIGO/FATOR DE RISCO | FONTE | POSSÍVEIS LESÕES | NÍVEL DE RISCO
[Preencher por frente: fundação, estrutura, alvenaria, elétrica, acabamento…]

3. PLANO DE AÇÃO (eliminar/reduzir riscos — hierarquia de controle)
MEDIDA | TIPO (coletiva/adm/EPI) | RESPONSÁVEL | PRAZO | STATUS

4. DOCUMENTOS E PROGRAMAS RELACIONADOS
[ ] PCMSO (NR-7)  [ ] Análises de risco/PT  [ ] Ordens de Serviço (NR-1)
[ ] Capacitações (NR-18/35/10/33…)  [ ] Inspeções de segurança  [ ] Áreas de vivência

5. MONITORAMENTO E REVISÃO
[Indicadores, inspeções periódicas; revisão bienal ou após acidente/mudança no processo]

[CIDADE], [DATA]

___________________________
Responsável técnico de segurança`
  }
];
