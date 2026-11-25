// GERADO por `npm run tipos` a partir de banco/esquema.json — não editar à mão.

/**
 * Uma carta como o motor e os pesos enxergam. Escrita por nós a partir do texto Oracle (Scryfall, público); nada copiado de roteiro de terceiros (Forge só serve para conferir divergência). Um arquivo por carta em banco/cartas/.
 */
export interface Carta {
  /**
   * nome oficial (frente, para dupla face)
   */
  n: string;
  custo?: RxMana;
  /**
   * valor de mana
   */
  vm?: number;
  /**
   * identidade de cor (CR 903.4)
   */
  ci?: string;
  cores?: string;
  tipos: (
    'Creature' | 'Artifact' | 'Enchantment' | 'Land' | 'Planeswalker' | 'Instant' | 'Sorcery' | 'Battle' | 'Kindred'
  )[];
  super?: ('Legendary' | 'Basic' | 'Snow' | 'World')[];
  /**
   * subtipos (Goblin, Equipment, Aura, Forest, Saga, Adventure…)
   */
  sub?: string[];
  /**
   * [poder, resistência]; '*' quando definido por estática cda
   *
   * @minItems 2
   * @maxItems 2
   */
  pt?: [number | string, number | string];
  /**
   * lealdade inicial
   */
  leal?: number;
  kw?: RxKw[];
  atv?: RxAtv[];
  gat?: RxGat[];
  est?: RxEst[];
  subst?: RxSubst[];
  /**
   * efeito ao resolver (mágica instantânea/feitiço)
   */
  fx?: RxFxs;
  /**
   * alvos escolhidos ao conjurar, referidos em fx por {"alvo":i}
   */
  alvos?: RxAlvo[];
  /**
   * outra face: dupla face, aventura, split, modal
   */
  faces?: RxFace[];
  forma?: 'normal' | 'duplaFace' | 'aventura' | 'split' | 'modal' | 'flip';
  /**
   * frases do Oracle (texto original, em inglês) que o motor ainda não sabe fazer; o motor joga o resto e a tela avisa
   */
  falta?: string[];
  /**
   * custo adicional para conjurar (além da mana)
   */
  custoAd?: RxCustoAtv;
  /**
   * versão do formato
   */
  v: 2;
  /**
   * oracle_id do Scryfall (o mesmo para todas as edições)
   */
  id: string;
  /**
   * 8 primeiros hex do sha1 do texto Oracle usado; muda numa errata → carta volta para revisão
   */
  oracleHash: string;
  /**
   * rastreio de quem escreveu e quando
   */
  rev: {
    /**
     * quem escreveu/revisou (adepto, Felipe)
     */
    por: string;
    em: string;
    /**
     * caso de teste em banco/testes/ que cobre a carta
     */
    teste?: string;
    nota?: string;
  };
  /**
   * custo a mais para cada alvo além do primeiro (Fireball)
   */
  impostoPorAlvo?: RxMana;
  /**
   * Classe: ganhar o nível como feitiço pagando o custo (716)
   */
  niveis?: {
    /**
     * nível (2, 3…); o nível 1 é o resto da carta
     */
    n: number;
    custo: RxMana;
    est?: RxEst[];
    gat?: RxGat[];
    atv?: RxAtv[];
  }[];
}

/**
 * custo de mana: g = genérico, p = símbolos coloridos (W U B R G C, híbrido 'R/W', 2/W, phyrexiano 'B/P'), x = quantos X
 */
export interface RxMana {
  g?: number;
  p?: string[];
  x?: number;
}

/**
 * número fixo, 'X' (o X pago), ou contagem
 */
export type RxQtd =
  | number
  | ('X' | 'maoInteira' | 'tudo')
  | {
      conta:
        | RxFiltro
        | (
            | 'vmDoAlvo'
            | 'vmDoEvento'
            | 'vmDoSacrificado'
            | 'poderDoSacrificado'
            | 'poderDoEste'
            | 'poderDoEvento'
            | 'resistDoEvento'
            | 'poderDoAlvo'
            | 'danoCausado'
            | 'vidaGanha'
            | 'cartasNaMao'
            | 'oponentes'
            | 'marcadoresNoEste'
            | 'evento'
            | 'X'
            | 'jogadores'
            | 'resistDoEste'
            | 'vmDoEste'
            | 'lembrados'
            | 'suaVida'
            | 'vidaInicial'
            | 'cartasNoGrimorio'
            | 'energia'
            | 'convergir'
            | 'dominio'
            | 'devocao'
            | 'impostoCmd'
            | 'seusTurnos'
            | 'resolvidasNoTurno'
            | 'magiasNoTurno'
            | 'coresDoEste'
            | 'resistDoAlvo'
            | 'marcadoresNoEvento'
            | 'maoDoAlvo'
            | 'vidaDoAlvo'
            | 'tipoMaisComum'
            | 'maiorEntreJogadores'
            | 'entrouNoTurno'
            | 'resultado'
            | 'se'
            | 'numeroEscolhido'
            | 'vidaGanhaNoTurno'
            | 'compradasNoTurno'
            | 'atacantes'
            | 'coresDoEvento'
            | 'ataquesNoTurno'
            | 'grimorioDoAlvo'
            | 'marcadoresSeus'
            | 'vezesKicker'
            | 'maoDoEvento'
            | 'vidaPerdidaOpsNoTurno'
            | 'maiorVidaPerdidaOpNoTurno'
            | 'vidaPerdidaNoTurno'
            | 'maiorDescarte'
            | 'resolucoesDestaHabNoTurno'
          );
      mult?: number;
      soma?: number;
      alvo?: number;
      /**
       * divide por 2 (arredonda p/ baixo)
       */
      metade?: boolean;
      /**
       * conta 'se': condição (kicked, promisedgift, morbid…)
       */
      cond?: string;
      sim?: number;
      nao?: number;
      /**
       * em vez de contar objetos: propriedade do conjunto
       */
      prop?:
        | 'cores'
        | 'somaPoder'
        | 'maiorPoder'
        | 'somaResist'
        | 'somaVm'
        | 'nomesDiferentes'
        | 'tiposDiferentes'
        | 'maiorVm';
      /**
       * devocao: cores (W U B R G); marcadores*: tipo do marcador
       */
      de?: string;
    }
  | {
      /**
       * N, X, 'qualquer' ou uma contagem (Kyoshi Island Plaza: até o nº de Shrines)
       */
      ate: number | 'X' | 'qualquer' | RxQtd;
    }
  | {
      /**
       * rola um dado de N lados (706); o resultado é a quantidade. O motor usa o RNG com semente; a análise usa a média (N+1)/2
       */
      dado: number;
    };

/**
 * quem (sem alvo): voce = controlador da carta; doEvento = o jogador do evento do gatilho; controlador/dono = do objeto afetado; {alvo:N} = o alvo N quando há vários
 */
export type RxJogador =
  | (
      | 'voce'
      | 'oponente'
      | 'cadaOponente'
      | 'cadaJogador'
      | 'alvoJogador'
      | 'dono'
      | 'controlador'
      | 'doEvento'
      | 'atacado'
      | 'proximo'
      | 'cadaAtual'
    )
  | {
      alvo: number;
    };

/**
 * mini-linguagem de objetos: todos os campos se somam (E)
 */
export interface RxFiltro {
  /**
   * a própria carta
   */
  este?: boolean;
  /**
   * exceto a própria carta
   */
  outro?: boolean;
  /**
   * algum destes tipos (Creature, Land, Permanent, Card, Spell, Token…)
   */
  tipo?: string[];
  /**
   * TODOS estes tipos ao mesmo tempo (criatura artefato: Urza, Chief Artificer); o tipo é 'algum destes'
   */
  tipoTodos?: string[];
  /**
   * nenhum destes tipos/subtipos/super (Land, Basic, Token…)
   */
  nao?: string[];
  /**
   * algum destes subtipos; 'escolhido' = tipo escolhido ao entrar
   */
  sub?: string[];
  super?: string[];
  ctrl?: 'voce' | 'oponente' | 'qualquer' | 'alvo' | 'cadaAtual' | 'doEvento';
  dono?: 'voce' | 'oponente' | 'qualquer' | 'alvo' | 'cadaAtual' | 'doEvento';
  /**
   * cor; lista = alguma destas (Goblin Anarchomancer: vermelha OU verde)
   */
  cor?: string | string[];
  zona?: RxZona;
  virada?: boolean;
  atacando?: boolean;
  /**
   * a criatura que este equipamento/aura está anexado
   */
  equipada?: boolean;
  comandante?: boolean;
  ficha?: boolean;
  vm?: RxCompara;
  poder?: RxCompara;
  resist?: RxCompara;
  /**
   * aura/equipamento anexado a esta carta
   */
  anexadoA?: 'este';
  /**
   * carta do topo do grimório
   */
  topo?: boolean;
  /**
   * objeto lembrado pelo efeito
   */
  lembrada?: boolean;
  /**
   * com pelo menos uma Aura anexada (ex.: Calix)
   */
  encantada?: boolean;
  /**
   * com pelo menos um Equipamento anexado (Cloud, Ex-SOLDIER: 'as long as it's equipped')
   */
  comEquipamento?: boolean;
  /**
   * equipada, encantada ou com marcador
   */
  modificada?: boolean;
  /**
   * foi conjurada (não só posta)
   */
  conjurada?: boolean;
  /**
   * a própria carta também conta ("este ou outro X")
   */
  ouEste?: boolean;
  /**
   * tem ao menos 1 marcador deste tipo
   */
  comMarcador?: string;
  /**
   * sem nenhum marcador (Damning Verdict)
   */
  semMarcador?: boolean;
  /**
   * tem estas palavras-chave
   */
  kw?: string[];
  /**
   * não tem o mesmo nome de outra permanente que você controla
   */
  nomeUnico?: boolean;
  /**
   * poder maior que o poder base
   */
  poderAcimaBase?: boolean;
  /**
   * artefato, lendário ou Saga (Excalibur)
   */
  historico?: boolean;
  /**
   * o objeto entrou no campo neste turno (Motivated Pony, Ocelot Pride; ficha criada neste turno = ficha + entrouNoTurno, Idol of Oblivion)
   */
  entrouNoTurno?: boolean;
  /**
   * a carta foi para o cemitério moída neste turno (Raul, Tato Farmer, The Master)
   */
  moidaNoTurno?: boolean;
}

export interface RxCompara {
  min?: RxQtd;
  max?: RxQtd;
  igual?: RxQtd;
}

export type RxZona = 'campo' | 'mao' | 'grimorio' | 'cemiterio' | 'exilio' | 'pilha' | 'comando' | 'qualquer';

export interface RxAlvo {
  f: RxFiltro | ('qualquerAlvo' | 'jogador' | 'oponente' | 'magica');
  min?: number;
  max?: number | 'qualquer';
  /**
   * true = quem conjura divide; 'igual' = dividido igualmente, arredondado para baixo (Fireball)
   */
  dividir?: boolean | 'igual';
  /**
   * alvo pode ser também um jogador (f OU jog)
   */
  jog?: 'jogador' | 'oponente';
  /**
   * alvo só existe se o modo N (fx modal) for escolhido
   */
  modo?: number;
  /**
   * um alvo para cada oponente (até 1 de cada)
   */
  porOponente?: boolean;
}

/**
 * sobre o que o efeito age: alvo escolhido (índice em 'alvos'), todos que batem no filtro, ou referência
 */
export type RxObjeto =
  | {
      alvo: number;
    }
  | {
      todos: RxFiltro;
    }
  | ('este' | 'equipada' | 'doEvento' | 'criadas' | 'escolhida' | 'anterior' | 'cadaAtual');

/**
 * custo de habilidade ativada / custo adicional / 'a menos que pague'
 */
export interface RxCustoAtv {
  mana?: RxMana;
  virar?: boolean;
  desvirar?: boolean;
  virarOutros?: {
    f?: RxFiltro;
    qtd?: number;
  };
  sacrificar?:
    | 'este'
    | {
        f?: RxFiltro;
        qtd?: number;
      };
  descartar?: number;
  revelar?: {
    f?: RxFiltro;
    qtd?: number;
  };
  exilarEste?: boolean;
  /**
   * vida paga; contagem vale no momento de pagar (Bolas's Citadel: vmDoEvento)
   */
  vida?: number | 'X' | RxQtd;
  /**
   * exilar como custo: só a zona (1 carta qualquer) ou {zona, f, qtd} (Drivnod: 3 criaturas do cemitério)
   */
  exilarDe?:
    | RxZona
    | {
        zona: RxZona;
        f?: RxFiltro;
        qtd?: number | RxQtd;
      };
  tirarMarcador?: {
    tipo?: string;
    qtd?: number;
  };
  /**
   * pôr marcador neste como custo (Devoted Druid: -1/-1)
   */
  porMarcador?: {
    tipo?: string;
    qtd?: number;
  };
}

export type RxDura = 'fimDoTurno' | 'proximoTurnoSeu' | 'enquantoAnexado' | 'enquantoNoCampo' | 'sempre';

export type RxFxs = RxFx[];

/**
 * um efeito. Campos comuns: talvez (o jogador pode escolher não fazer), quem (jogador que faz/recebe), em (objeto afetado), qtd, se (condição), aMenosQue (outro jogador paga para impedir)
 */
export interface RxFx {
  op:
    | 'mana'
    | 'comprar'
    | 'descartar'
    | 'moer'
    | 'videncia'
    | 'cavar'
    | 'revelarTopo'
    | 'mover'
    | 'buscar'
    | 'embaralhar'
    | 'ficha'
    | 'copiarPermanente'
    | 'copiarMagica'
    | 'dano'
    | 'destruir'
    | 'sacrificar'
    | 'anular'
    | 'exilar'
    | 'ganharVida'
    | 'perderVida'
    | 'virar'
    | 'desvirar'
    | 'marcador'
    | 'proliferar'
    | 'modificar'
    | 'animar'
    | 'ganharControle'
    | 'anexar'
    | 'fasear'
    | 'transformar'
    | 'efeitoTemporario'
    | 'gatilhoAtrasado'
    | 'escolher'
    | 'modal'
    | 'repetirCada'
    | 'jogar'
    | 'faseExtra'
    | 'turnoExtra'
    | 'ganharJogo'
    | 'perderJogo'
    | 'regenerar'
    | 'virarMonarca'
    | 'descobrir'
    | 'vigiar'
    | 'lutar'
    | 'moverMarcador'
    | 'tentarAnel'
    | 'explorar'
    | 'amassar'
    | 'popular';
  talvez?: boolean;
  quem?: RxJogador;
  em?: RxObjeto;
  qtd?: RxQtd;
  se?: RxCond;
  aMenosQue?: {
    quem: RxJogador;
    custo: RxCustoAtv;
  };
  /**
   * mana: cores produzidas; 'qualquer', 'comandante' (identidade), ou lista de opções; 'deSeusTerrenos' = um tipo que um terreno seu poderia produzir (Incubation Druid)
   */
  prod?: ('qualquer' | 'comandante' | 'refletida' | 'escolhida' | 'deSeusTerrenos') | string[];
  de?: RxZona;
  para?: RxZona;
  /**
   * buscar/cavar/escolher: o que pode ser pego
   */
  f?: RxFiltro;
  virada?: boolean;
  atacando?: boolean;
  revelar?: boolean;
  sobControle?: RxJogador;
  /**
   * mover para o grimório: embaixo
   */
  fundo?: boolean;
  olha?: RxQtd;
  pega?: RxQtd;
  resto?: RxZona;
  /**
   * buscar com divisão (Cultivate: 1 no campo virado, 1 na mão); também no cavar (Expressive Iteration: 1 na mão, 1 no fundo, 1 no exílio jogável)
   */
  destinos?: {
    para?: RxZona;
    qtd?: number;
    virada?: boolean;
  }[];
  token?: RxToken;
  /**
   * marcador: +1/+1, -1/-1, loyalty, charge…
   */
  tipoMarc?: string;
  p?: RxQtd;
  r?: RxQtd;
  kw?: RxKw[];
  dura?: RxDura;
  /**
   * efeitoTemporario: estáticas que valem pela duração
   */
  est?: RxEst[];
  subst?: RxSubst[];
  /**
   * gatilhoAtrasado
   */
  quando?: RxGat;
  /**
   * escolher: o quê
   */
  o?: 'tipoCriatura' | 'cor' | 'jogador' | 'numero' | 'carta' | 'modo' | 'tipo';
  escolhe?: {
    min?: number;
    max?: number;
    maxSe?: {
      se?: RxCond;
      max?: number;
    };
  };
  modos?: RxFxs[];
  cada?: RxJogador | RxFiltro;
  /**
   * repetirCada / sub-efeito
   */
  fx?: RxFxs;
  gratis?: boolean;
  semPilha?: boolean;
  /**
   * só faz se o controlador pagar este custo
   */
  pagando?: RxCustoAtv;
  /**
   * anexar: a quem
   */
  a?: RxObjeto;
  tipos?: string[];
  sub?: string[];
  cores?: string;
  habil?: {
    atv?: unknown[];
    gat?: unknown[];
  };
  semHabil?: boolean;
  /**
   * efeitoTemporario: gatilhos que valem pela duração
   */
  gat?: RxGat[];
  emblema?: boolean;
  /**
   * copiarMagica: pode escolher novos alvos
   */
  novoAlvo?: boolean;
  /**
   * marcador: remover em vez de pôr
   */
  tirar?: boolean;
  /**
   * faseExtra: qual
   */
  fase?: 'combate' | 'principal' | 'turno';
  /**
   * animar: perde estas palavras-chave
   */
  tiraKw?: RxKw[];
  /**
   * animar: ganha todos os tipos de criatura
   */
  todosTipos?: boolean;
  /**
   * lutar: com quem
   */
  com?: RxObjeto;
  /**
   * mana: só pode ser gasta em mágica/habilidade que bata no filtro (Unclaimed Territory, Cavern of Souls)
   */
  so?: RxFiltro;
  /**
   * op mana: gatilho quando a mana é gasta numa mágica que bate em f (Path of Ancestry)
   */
  aoGastar?: {
    f?: RxFiltro;
    fx?: RxFxs;
  };
  /**
   * op mana: a mágica paga com esta mana não pode ser anulada (Cavern of Souls)
   */
  naoAnulavel?: boolean;
  /**
   * op jogar: true = só conjurar (mágica); sem o campo = jogar (terreno também)
   */
  soConjurar?: boolean;
  /**
   * cavar: revela do topo ATÉ achar qtd cartas que batem em f (Empty the Laboratory, Etali); o resto vai conforme `resto`
   */
  ateAchar?: {
    f: RxFiltro;
    qtd?: RxQtd;
  };
  /**
   * moverMarcador: o objeto que recebe os marcadores (o `em` é de onde saem; Forgotten Ancient)
   */
  paraObj?: RxObjeto;
  /**
   * descartar ao acaso (Gamble) · também vale para escolher modos ao acaso (Outlaws' Merriment)
   */
  aleatorio?: boolean;
  /**
   * op mana: a mana não some entre passos e fases até o fim do turno (Birgi, Klauth)
   */
  ficaNoTurno?: boolean;
  /**
   * op destruir: não pode ser regenerada (Pongify, Artifact Mutation)
   */
  semRegenerar?: boolean;
  /**
   * op sacrificar: cada jogador escolhe N que ficam e sacrifica o resto do filtro (Archfiend of Depravity, Ajani Nacatl Pariah, Promise of Loyalty)
   */
  exceto?: {
    qtd: number;
    /**
     * N de CADA um destes tipos (Archfiend: 2 criaturas; Promise of Loyalty: 1)
     */
    porTipo?: string[];
  };
  /**
   * This interface was referenced by `RxFx`'s JSON-Schema definition
   * via the `patternProperty` "^_".
   */
  [k: string]: unknown;
}

/**
 * ficha: descrita ou nomeada (as comuns: Treasure, Clue, Food, Blood…)
 */
export interface RxToken {
  nome?: string;
  /**
   * P/R da ficha; contagem ou X vale o número no momento de criar (Assemble the Entmoot X/X)
   *
   * @minItems 2
   * @maxItems 2
   */
  pt?: [number | RxQtd, number | RxQtd];
  cores?: string;
  tipos?: string[];
  sub?: string[];
  super?: string[];
  kw?: RxKw[];
  atv?: RxAtv[];
  copiaDe?: RxObjeto;
  anexadaA?: 'criadas' | 'este';
  /**
   * cópia sem o supertipo lendário
   */
  naoLendaria?: boolean;
  /**
   * gatilhos da ficha (Circle of Power, Cornered by Black Mages)
   */
  gat?: RxGat[];
}

/**
 * condição (todas valem juntas)
 */
export interface RxCond {
  controla?: {
    f?: RxFiltro;
    min?: number;
  };
  esteEm?: RxZona[];
  turno?: 'seu' | 'deOutro';
  /**
   * o 'se fizer' / 'se não fizer' do efeito anterior
   */
  pagou?: boolean;
  /**
   * o objeto do evento bate no filtro
   */
  eventoBate?: RxFiltro;
  vidaMax?: number;
  vidaMin?: number;
  /**
   * algum oponente tem vida ≤ N (Bloodghast)
   */
  vidaOponenteMax?: number;
  conjuradaCom?: 'sobrecarga' | 'kicker' | 'flashback' | 'madness' | 'evoke';
  /**
   * Addendum: ESTA mágica foi conjurada durante a fase principal do controlador (implica turno seu; vale o momento de conjurar, não o de resolver)
   */
  conjuradaNaPrincipal?: boolean;
  /**
   * a contagem q compara (min/max/igual)
   */
  conta?: {
    q: RxQtd;
    min?: number;
    max?: number;
    igual?: number;
  };
  /**
   * quantos objetos batem no filtro (padrão: ≥1)
   */
  existe?: {
    f: RxFiltro;
    min?: number;
    max?: number;
    igual?: number;
  };
  /**
   * o objeto referido bate (ou não) no filtro
   */
  objBate?: {
    em?: RxObjeto;
    f?: RxFiltro;
    nao?: boolean;
  };
  /**
   * condição nomeada: metalcraft, blessing, maxspeed…
   */
  palavra?: string;
  /**
   * você é o monarca
   */
  monarca?: boolean;
  /**
   * você tem um Portador do Anel (o Anel te tentou)
   */
  portadorDoAnel?: boolean;
  /**
   * oponente controla mais terrenos que você: 'algum' = algum oponente (Land Tax, Loyal Warhound); 'doEvento' = o jogador do evento (Archaeomancer's Map)
   */
  maisTerrenosOponente?: 'algum' | 'doEvento';
  /**
   * é a primeira fase de combate do turno (Genji Glove, Karlach)
   */
  primeiroCombate?: boolean;
  /**
   * é a fase principal (1 ou 2) do controlador (Moraug); só 'turno seu' = cond turno
   */
  fasePrincipal?: boolean;
}

export interface RxKw {
  /**
   * sobrecarga: o motor troca 'alvo' por 'cada' (CR 702.96); aventura/loucura/flashback idem pela regra, não pelo fx
   */
  k:
    | 'voar'
    | 'vigilancia'
    | 'atropelar'
    | 'vinculoVida'
    | 'pressa'
    | 'indestrutivel'
    | 'lampejo'
    | 'primeiroAtaque'
    | 'golpeDuplo'
    | 'toqueMortifero'
    | 'alcance'
    | 'ameaca'
    | 'protecao'
    | 'resguardo'
    | 'rachadura'
    | 'antimagia'
    | 'manto'
    | 'metamorfo'
    | 'defensor'
    | 'equipar'
    | 'encantar'
    | 'ciclar'
    | 'cicloTipo'
    | 'sobrecarga'
    | 'flashback'
    | 'afinidade'
    | 'convocar'
    | 'improvisar'
    | 'loucura'
    | 'chute'
    | 'ofertaPresente'
    | 'esconderijo'
    | 'ascender'
    | 'tempestade'
    | 'parceiro'
    | 'parceiroCom'
    | 'escolhaAntecedente'
    | 'mentor'
    | 'proeza'
    | 'tripular'
    | 'fabricar'
    | 'posVida'
    | 'caminhadaTerreno'
    | 'armaduraUmbra'
    | 'corpo-a-corpo'
    | 'prever'
    | 'evoluir'
    | 'persistir'
    | 'eternizar'
    | 'agregar'
    | 'miriade'
    | 'mobilizar'
    | 'eco'
    | 'bis'
    | 'prole'
    | 'capitulo'
    | 'classe'
    | 'entraComMarcador'
    | 'tumulto'
    | 'fusao'
    | 'intimidar'
    | 'decaida';
  custo?: RxMana;
  n?: number;
  /**
   * proteção de/resguardo: cor (W/U/B/R/G), 'cadaCor' (de cada cor: uma palavra só, não 5), 'tudo', tipo
   */
  de?: string;
  tipo?: string;
  f?: RxFiltro;
  /**
   * resguardo com custo que não é mana (pagar vida)
   */
  pagar?: RxCustoAtv;
}

export interface RxAtv {
  custo: RxCustoAtv;
  fx: RxFxs;
  alvos?: RxAlvo[];
  vel?: 'instantaneo' | 'feitico';
  zona?: RxZona;
  limite?: 'umaPorTurno' | 'umaPorTurnoPorJogador';
  /**
   * habilidade de mana: não usa a pilha (CR 605)
   */
  deMana?: boolean;
  lealdade?: number;
  /**
   * "Activate only if …"
   */
  se?: RxCond;
}

export interface RxGat {
  ev:
    | 'entra'
    | 'morre'
    | 'vaiCemiterio'
    | 'sai'
    | 'fase'
    | 'ataca'
    | 'atacantesDeclarados'
    | 'bloqueia'
    | 'conjura'
    | 'dano'
    | 'danoUmaVez'
    | 'compra'
    | 'ganhaVida'
    | 'perdeVida'
    | 'sacrificado'
    | 'marcadorPosto'
    | 'alvoDe'
    | 'vira'
    | 'zonaVarios'
    | 'capitulo'
    | 'saiCemiterio'
    | 'fichaCriada'
    | 'viraParaMana'
    | 'descarta'
    | 'moe'
    | 'explora';
  /**
   * com ev 'sai': só quando NÃO foi para o cemitério vindo do campo por morte (Dour Port-Mage)
   */
  naoMorre?: boolean;
  /**
   * objeto do evento (criatura que entra/ataca/morre, mágica conjurada…)
   */
  quem?: RxFiltro;
  /**
   * jogador do evento (quem conjura/compra/perde vida; quem leva dano)
   */
  jog?: RxJogador;
  /**
   * ev fase
   */
  passo?: 'manutencao' | 'compra' | 'inicioCombate' | 'final' | 'principal1' | 'principal2' | 'fimCombate';
  /**
   * ev fase: no turno de quem
   */
  deQuem?: 'voce' | 'cadaJogador' | 'oponente';
  combate?: boolean;
  aJogador?: boolean;
  /**
   * o dano/alvo é um OPONENTE de quem controla o gatilho (Curiosity)
   */
  aOponente?: boolean;
  /**
   * de onde dispara (eminência: comando + campo)
   */
  zonaAtiva?: RxZona[];
  /**
   * condição de intervenção ('if …', CR 603.4)
   */
  se?: RxCond;
  limite?: 'umaPorTurno' | 'umaPorTurnoPorJogador';
  talvez?: boolean;
  alvos?: RxAlvo[];
  fx?: RxFxs;
  /**
   * alvoDe: o que mira (mágica, habilidade)
   */
  por?: RxFiltro;
  /**
   * dispara uma vez para o grupo que muda de zona junto
   */
  grupo?: boolean;
  /**
   * gatilho atrasado: só no próximo turno
   */
  proximoTurno?: boolean;
  /**
   * gatilho atrasado: vale só neste turno
   */
  nesteTurno?: boolean;
  /**
   * capitulo: número do capítulo da saga
   */
  n?: number;
  /**
   * atacantesDeclarados: todos atacando o mesmo jogador
   */
  umAlvo?: boolean;
  /**
   * marcadorPosto: tipo do marcador
   */
  marc?: string;
  /**
   * conjura: também quando copia
   */
  ouCopia?: boolean;
  /**
   * zona de origem do objeto que mudou de zona
   */
  de?: RxZona;
  /**
   * "from anywhere other than …"
   */
  naoDe?: RxZona;
  /**
   * ev dano: quem RECEBE o dano ('quem' = a fonte). Enrage/'é causado dano a esta' → recebe {este: true} (Apex Altisaur, Metropolis Reformer)
   */
  recebe?: RxFiltro;
  /**
   * ev compra: exceto a primeira carta que o jogador compra no passo de compra dele (Orcish Bowmasters, Bard)
   */
  naoPrimeira?: boolean;
}

export interface RxEst {
  /**
   * naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta
   */
  modo:
    | 'continuo'
    | 'reduzCusto'
    | 'aumentaCusto'
    | 'maoMax'
    | 'dobraGatilhoEntrar'
    | 'terraExtra'
    | 'custoAlternativo'
    | 'naoPodeConjurar'
    | 'deveAtacar'
    | 'naoPodeAtacar'
    | 'naoPodeBloquear'
    | 'naoPodeSerBloqueada'
    | 'conjurarComLampejo'
    | 'desviraNoTurnoDeOutro'
    | 'vidaNaoMuda'
    | 'protecaoJogador'
    | 'ptDefinido'
    | 'danoNaoPrevenivel'
    | 'podeJogar'
    | 'podeOlhar'
    | 'dobraGatilho'
    | 'ataqueCusta'
    | 'naoPodeAtivar';
  afeta?: RxFiltro | RxJogador | ('este' | 'equipada');
  p?: RxQtd;
  r?: RxQtd;
  pt?: unknown[];
  kw?: RxKw[];
  tipo?: string[];
  habil?: {
    atv?: unknown[];
    gat?: unknown[];
  };
  qtd?: RxQtd;
  /**
   * ataqueCusta: quanto paga por criatura atacante (+ qtd se for {X})
   */
  custo?: RxMana;
  se?: RxCond;
  /**
   * CR 613: '1','2','3','4','5','6','7a'…'7d'; o conversor preenche
   */
  camada?: string;
  de?: RxZona;
  limite?: number;
  gratis?: boolean;
  /**
   * poder definido (CDA, camada 7a)
   */
  pBase?: RxQtd;
  rBase?: RxQtd;
  /**
   * custoAlternativo: o que paga em vez do custo de mana
   */
  pagar?: RxCustoAtv;
  /**
   * naoPodeConjurar: quais mágicas
   */
  f?: RxFiltro;
  /**
   * dobraGatilho: só gatilhos destes eventos
   */
  evs?: string[];
  /**
   * dobraGatilho: objeto que causa o evento
   */
  causa?: RxFiltro;
  /**
   * continuo: perde estes tipos (deus com devoção baixa)
   */
  tiraTipo?: string[];
  /**
   * naoPodeAtacar/ataqueCusta: o defensor (jogador e/ou permanente)
   */
  contra?: {
    jog?: RxJogador;
    f?: RxFiltro;
  };
  /**
   * aumentaCusto: só mágicas/habilidades que miram o afetado
   */
  aoMirar?: boolean;
  /**
   * aumentaCusto: de quem são as mágicas
   */
  quem?: RxJogador;
  /**
   * aumentaCusto/reduzCusto: vale para habilidades, não mágicas (Forensic Gadgeteer)
   */
  deHabil?: boolean;
  /**
   * naoPodeSerBloqueada / naoPodeBloquear: filtro de QUEM bloqueia (Amrou Kithkin)
   */
  por?: RxFiltro;
  /**
   * subtipos que o continuo dá além dos tipos (Ashaya: tipo Land + sub Forest; 305.6/305.7)
   */
  sub?: string[];
  /**
   * continuo: o objeto passa a ter SÓ estas cores (Nim Deathmantle 'B'; Leyline of the Guildpact 'WUBRG')
   */
  cores?: string;
}

/**
 * substituição (CR 614): quando o evento ev for acontecer com quem, faz 'muda' ou 'emVez'
 */
export interface RxSubst {
  ev: 'entra' | 'ficha' | 'marcador' | 'morre' | 'vaiCemiterio' | 'dano' | 'compra' | 'anulada' | 'vidaMuda';
  quem?: RxFiltro;
  muda?: {
    virada?: boolean;
    mult?: number;
    soma?: number;
    /**
     * entra com estes marcadores a mais: {tipo: qtd}
     */
    marcadores?: {
      [k: string]: RxQtd;
    };
    para?: RxZona;
    prevenir?: boolean;
    /**
     * o evento não acontece (não pode ser anulada)
     */
    impedir?: boolean;
    /**
     * cria também esta ficha (Peregrin Took)
     */
    maisFicha?: RxToken;
    /**
     * em vez disso cria uma de cada (Academy Manufactor)
     */
    trocaPor?: RxToken[];
    /**
     * dano cai à metade, arredondada para baixo
     */
    metade?: boolean;
    /**
     * no máximo N (previne todo menos N)
     */
    teto?: number;
    /**
     * quantas fichas a mais (padrão 1)
     */
    maisQtd?: number;
  };
  aMenosQue?: {
    quem?: RxJogador;
    custo?: RxCustoAtv;
  };
  emVez?: RxFxs;
  talvez?: boolean;
  jog?: RxJogador;
  combate?: boolean;
  /**
   * fonte do evento
   */
  por?: RxFiltro;
  se?: RxCond;
  /**
   * tipo do marcador ('+1/+1', 'loyalty'…)
   */
  marc?: string;
  /**
   * compra: exceto a primeira carta que o jogador compra no turno/passo (Bard, como o gat naoPrimeira)
   */
  naoPrimeira?: boolean;
}

/**
 * outra face (dupla face, aventura, split, modal): mesmos campos da carta, sem v/id/oracleHash/rev
 */
export interface RxFace {
  /**
   * nome oficial (frente, para dupla face)
   */
  n: string;
  custo?: RxMana;
  /**
   * valor de mana
   */
  vm?: number;
  /**
   * identidade de cor (CR 903.4)
   */
  ci?: string;
  cores?: string;
  tipos: (
    'Creature' | 'Artifact' | 'Enchantment' | 'Land' | 'Planeswalker' | 'Instant' | 'Sorcery' | 'Battle' | 'Kindred'
  )[];
  super?: ('Legendary' | 'Basic' | 'Snow' | 'World')[];
  /**
   * subtipos (Goblin, Equipment, Aura, Forest, Saga, Adventure…)
   */
  sub?: string[];
  /**
   * [poder, resistência]; '*' quando definido por estática cda
   *
   * @minItems 2
   * @maxItems 2
   */
  pt?: [number | string, number | string];
  /**
   * lealdade inicial
   */
  leal?: number;
  kw?: RxKw[];
  atv?: RxAtv[];
  gat?: RxGat[];
  est?: RxEst[];
  subst?: RxSubst[];
  /**
   * efeito ao resolver (mágica instantânea/feitiço)
   */
  fx?: RxFxs;
  /**
   * alvos escolhidos ao conjurar, referidos em fx por {"alvo":i}
   */
  alvos?: RxAlvo[];
  forma?: 'normal' | 'duplaFace' | 'aventura' | 'split' | 'modal' | 'flip';
  /**
   * frases do Oracle (texto original, em inglês) que o motor ainda não sabe fazer; o motor joga o resto e a tela avisa
   */
  falta?: string[];
  /**
   * custo adicional para conjurar (além da mana)
   */
  custoAd?: RxCustoAtv;
  /**
   * custo a mais para cada alvo além do primeiro (Fireball)
   */
  impostoPorAlvo?: RxMana;
}
