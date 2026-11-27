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
  /**
   * fundir: faces[0] é a carta fundida (meld, 712.4): Gisela → Brisela; preparar: faces[0] é a mágica de preparo (layout prepare); a criatura preparada deixa conjurar uma cópia dela do exílio
   */
  forma?: 'normal' | 'duplaFace' | 'aventura' | 'split' | 'modal' | 'flip' | 'fundir' | 'preparar';
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
  /**
   * "cast this spell only during …" (601.3): só no passo e/ou só no turno de quem (Illusionist's Gambit: bloqueadores, oponente)
   */
  conjurarSo?: {
    passo?:
      | 'desvirar'
      | 'manutencao'
      | 'compra'
      | 'principal1'
      | 'inicioCombate'
      | 'atacantes'
      | 'bloqueadores'
      | 'dano'
      | 'fimCombate'
      | 'principal2'
      | 'final';
    turno?: 'seu' | 'oponente';
  };
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
      conta: RxContagem;
      mult?: number;
      soma?: number;
      /**
       * divide por N arredondando para cima (Dire Fleet Ravager: um terço da vida = 3)
       */
      divCima?: number;
      /**
       * divide por 2 (arredonda p/ baixo)
       */
      metade?: boolean;
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
 * quem (sem alvo): voce = controlador da carta; doEvento = o jogador do evento do gatilho; controlador/dono = do objeto afetado; {alvo:N} = o alvo N quando há vários; atacado = o jogador DEFENSOR: o que a criatura do evento (ev ataca) ou a afetada pela estática está atacando (Goblin Guide, Silumgar, Trailblazer's Boots); oponente = um oponente que você escolhe ao resolver (sem alvo); umJogador = "choose a player": você escolhe qualquer jogador ao resolver (Gluntch)
 */
export type RxJogador =
  | (
      | 'voce'
      | 'oponente'
      | 'cadaOponente'
      | 'cadaOutroOponente'
      | 'cadaJogador'
      | 'alvoJogador'
      | 'dono'
      | 'controlador'
      | 'doEvento'
      | 'atacado'
      | 'proximo'
      | 'cadaAtual'
      | 'atacadosPorEste'
      | 'umJogador'
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
   * exceto a própria carta; 'doEvento' = exceto o objeto do evento ("each other attacking creature" que compartilha tipo com ela, Shared Animosity)
   */
  outro?: boolean | 'doEvento';
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
  ctrl?: 'voce' | 'oponente' | 'qualquer' | 'alvo' | 'cadaAtual' | 'doEvento' | 'atacado';
  dono?: 'voce' | 'oponente' | 'qualquer' | 'alvo' | 'cadaAtual' | 'doEvento' | 'atacado';
  /**
   * cor; lista = alguma destas (Goblin Anarchomancer: vermelha OU verde)
   */
  cor?: string | string[];
  /**
   * lista = em alguma destas zonas (Visions of Glory: comandante no campo ou na zona de comando)
   */
  zona?: RxZona | [RxZona, RxZona, ...RxZona[]];
  virada?: boolean;
  /**
   * 'oponente': atacando um oponente seu (o jogador, não planeswalker; Frontier Warmonger)
   */
  atacando?: boolean | 'oponente';
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
   * criatura que convocou a mágica que resolve ("each creature that convoked this spell": Lethal Scheme, CR 702.51c)
   */
  convocou?: boolean;
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
   * foi conjurada (não só posta); com zona: conjurada DE lá ("if you cast it from your hand" = 'mao'; Cyclone Summoner, Wakening Sun's Avatar)
   */
  conjurada?: boolean | ('mao' | 'cemiterio' | 'exilio' | 'comando' | 'grimorio');
  /**
   * a própria carta também conta ("este ou outro X")
   */
  ouEste?: boolean;
  /**
   * atacante que não foi bloqueado (depois da declaração de bloqueadores; ninjutsu)
   */
  naoBloqueada?: boolean;
  /**
   * texto = tem ao menos 1 marcador deste tipo; true = tem algum marcador (Mutational Advantage)
   */
  comMarcador?: boolean | string;
  /**
   * recebeu dano deste objeto neste turno (Markov Enforcer: 'a creature dealt damage by this creature this turn dies')
   */
  feridaPorEsteNoTurno?: boolean;
  /**
   * no exílio, exilada por este objeto (op mover com comEste; 607.2a 'exiled with this': Bag of Holding)
   */
  exiladaPorEste?: boolean;
  /**
   * true = sem nenhum marcador (Damning Verdict); texto = sem marcador deste tipo (Wave Goodbye: '+1/+1')
   */
  semMarcador?: boolean | string;
  /**
   * tem estas palavras-chave
   */
  kw?: string[];
  /**
   * true = não tem o mesmo nome de outra permanente que você controla; 'criaturaOuCemiterio' = nem de outra criatura sua nem de carta de criatura no seu cemitério (Guardian Project)
   */
  nomeUnico?: boolean | 'criaturaOuCemiterio';
  /**
   * criatura com poder MAIOR que o de cada outra criatura no campo (estritamente; Selvala, Heart of the Wilds)
   */
  maiorPoder?: boolean;
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
  /**
   * a criatura atacou neste turno (Riders of the Mark e mais 2)
   */
  atacouNoTurno?: boolean;
  /**
   * nome exato da carta (Oracle, face da frente); para 'named <esta carta>' escrever o próprio nome (Ancestral Anger, Wedding Ring)
   */
  nome?: string;
  /**
   * compartilha ao menos um tipo de criatura com: esta carta (Folk Hero, Wolf-Skull Shaman), o seu comandante (Path of Ancestry), o objeto do evento (Shared Animosity) ou alguma permanente do filtro (Descendants' Path: criatura sua)
   */
  tipoEmComum?: ('este' | 'comandante' | 'doEvento') | RxFiltro;
  /**
   * com {X} no custo de mana (Frontline Medic)
   */
  comX?: boolean;
  /**
   * tem um tipo de card (CR 205.2a) em comum com este objeto ou com algum que bate no filtro (Semblance Anvil: com a carta exilada por este); "sacrificada" = a primeira permanente sacrificada por este efeito (Braids, Arisen Nightmare)
   */
  tipoCartaEmComum?: 'este' | 'sacrificada' | RxFiltro;
  /**
   * não é o objeto escolhido como alvo N desta mágica/habilidade ("each other creature" depois de mirar uma: Chandra's Ignition)
   */
  naoAlvo?: number;
  /**
   * não tem este nome ("not named Tiamat")
   */
  naoNome?: string;
  /**
   * Montaria selada neste turno (702.171b)
   */
  selada?: boolean;
  /**
   * bate em ao menos um destes (junto com os outros campos): "a Human or artifact card" = ou [{sub:[Human]}, {tipo:[Artifact]}] (Boromir, Gondor's Hope)
   *
   * @minItems 2
   */
  ou?: [RxFiltro, RxFiltro, ...RxFiltro[]];
  /**
   * posta no campo por uma habilidade desta fonte (Kodama of the East Tree: 'if it wasn't put onto the battlefield with this ability')
   */
  postaPorEste?: boolean;
  /**
   * mágica/habilidade na pilha cujos alvos são todos este objeto, e ao menos um ("a spell that targets only Zada")
   */
  soMiraEste?: true;
  /**
   * mágica/habilidade na pilha com ao menos um alvo que bate neste filtro ("a spell that targets one or more creatures you control", Arcee)
   */
  miraUm?: RxFiltro;
  /**
   * mana gasta para conjurar esta mágica (na pilha): "if no mana was spent to cast it" = {max:0} (Boromir, Warden of the Tower)
   */
  manaGasta?: RxCompara;
  /**
   * não tem nenhuma destas palavras-chave ("if it didn't have decayed": Wilhelt)
   */
  semKw?: string[];
}

export interface RxCompara {
  min?: RxQtd;
  max?: RxQtd;
  igual?: RxQtd;
}

export type RxZona = 'campo' | 'mao' | 'grimorio' | 'cemiterio' | 'exilio' | 'pilha' | 'comando' | 'qualquer';

export interface RxAlvo {
  /**
   * filtro ou: qualquerAlvo | jogador | oponente | magica | habilidade (ativada ou desencadeada na pilha: Tishana's Tidebinder)
   */
  f: RxFiltro | ('qualquerAlvo' | 'jogador' | 'oponente' | 'magica' | 'habilidade' | 'magicaOuHab');
  /**
   * mínimo de alvos (padrão 1); 'X' = exatamente X ("return X target cards", Shigeki): o X escolhido não passa do número de alvos possíveis
   */
  min?: number | 'X';
  /**
   * N, 'qualquer' ou uma contagem ("up to X targets", X = as não-terreno moídas: The Wise Mothman)
   */
  max?: number | 'qualquer' | RxQtd;
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
   * um alvo para cada jogador (até 1 de cada; permanente = de quem controla, carta fora do campo = do dono): Afterlife from the Loam
   */
  porJogador?: boolean;
  /**
   * um alvo para cada oponente (até 1 de cada)
   */
  porOponente?: boolean;
  /**
   * "with total mana value N or less": a soma do valor de mana dos escolhidos neste alvo não passa de N (Rampaging Yao Guai; CR 601.2c)
   */
  vmTotal?: RxQtd;
  /**
   * "another target": não pode ser o escolhido no alvo N
   */
  diferenteDe?: number;
  /**
   * "with different controllers": cada alvo escolhido tem um controlador diferente (Blade Beam)
   */
  ctrlDiferentes?: true;
  /**
   * o alvo só existe com (ou sem) chute/presente; 'instead' com alvo diferente vira dois alvos, um de cada opção (Tear Asunder, Long River's Pull, Wear Down)
   */
  opcao?: 'chute' | 'semChute' | 'presente' | 'semPresente';
  /**
   * o alvo pode bater este outro filtro em vez do f (Sink into Stupor: magia de oponente na pilha OU permanente não-terreno dele)
   */
  ou?: RxFiltro;
  /**
   * o alvo também pode estar nesta zona, com o mesmo filtro (Angel of Serenity: criatura no campo e/ou carta de criatura num cemitério)
   */
  ouZona?: RxZona;
}

/**
 * sobre o que o efeito age: alvo escolhido (índice em 'alvos'), todos que batem no filtro, ou referência; danificado = no gatilho de dano, a permanente que levou o dano (Ghyrson Starn)
 */
export type RxObjeto =
  | {
      alvo: number;
    }
  | {
      todos: RxFiltro;
    }
  | {
      um: RxFiltro;
    }
  | (
      | 'este'
      | 'equipada'
      | 'doEvento'
      | 'criadas'
      | 'escolhida'
      | 'anterior'
      | 'cadaAtual'
      | 'descartadaCusto'
      | 'sacrificada'
      | 'danificado'
    );

/**
 * custo de habilidade ativada / custo adicional / 'a menos que pague'
 */
export interface RxCustoAtv {
  /**
   * escolha entre custos: paga UM destes (Demand Answers: sacrificar um artefato OU descartar uma carta); só em custoAd; o resto do objeto vale para todas
   *
   * @minItems 2
   */
  ou?: [RxCustoAtv, RxCustoAtv, ...RxCustoAtv[]];
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
        /**
         * uma permanente para cada filtro, todas diferentes (Jarad: 'Sacrifice a Swamp and a Forest'); no lugar de f/qtd
         */
        e?: RxFiltro[];
        /**
         * sacrifica também esta (Glass-Cast Heart: 'Sacrifice this artifact and thirteen Blood tokens')
         */
        comEste?: boolean;
        /**
         * outro grupo sacrificado junto, com objetos diferentes (Jarad: 'Sacrifice a Swamp and a Forest')
         */
        tambem?: {
          f?: RxFiltro;
          qtd?: number;
        };
      };
  descartar?: number;
  revelar?: {
    f?: RxFiltro;
    qtd?: number;
  };
  exilarEste?: boolean;
  /**
   * descartar esta carta como custo (canalizar, Trumpeting Carnosaur): a habilidade é ativada da mão
   */
  descartarEste?: boolean;
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
    /**
     * "remove one or more": quem ativa escolhe quantos (≥ qtd); o número vai em {conta:{de:'custo',o:'marcadores'}} (Arcee)
     */
    umOuMais?: boolean;
  };
  /**
   * pôr marcador neste como custo (Devoted Druid: -1/-1)
   */
  porMarcador?: {
    tipo?: string;
    qtd?: number;
  };
  /**
   * devolver à mão do dono como custo: 'este' (Shigeki) ou {f, qtd} uma permanente sua que bate no filtro (Master Transmuter, Mina and Denn)
   */
  devolver?:
    | 'este'
    | {
        f?: RxFiltro;
        qtd?: number;
      };
  /**
   * pôr esta no fundo do grimório do dono como custo (Timestream Navigator)
   */
  fundoEste?: boolean;
  /**
   * desvirar N permanentes viradas suas que batem em f (Halo Fountain: 'Untap two tapped creatures you control')
   */
  desvirarOutros?: {
    f?: RxFiltro;
    qtd?: number;
  };
  /**
   * exercer (CR 701.43a): a fonte não desvira no próximo passo de desvirar do controlador
   */
  exercer?: boolean;
  /**
   * com descartar: só cartas que batem neste filtro ("Discard a creature card": Tortured Existence)
   */
  descartarF?: RxFiltro;
}

export type RxDura =
  'fimDoTurno' | 'proximoTurnoSeu' | 'proximoFinalSeu' | 'enquantoAnexado' | 'enquantoNoCampo' | 'sempre';

export type RxFxs = RxFx[];

/**
 * um efeito. Campos comuns: talvez (o jogador pode escolher não fazer), quem (jogador que faz/recebe), em (objeto afetado), qtd, se (condição), aMenosQue (outro jogador paga para impedir)
 */
export interface RxFx {
  /**
   * fundir: exila esta e uma permanente que bate em f (sua, de que você é dono) e põe no campo a carta fundida (faces[0], forma fundir); virada/atacando valem para ela (Mishra); monstruosidade: se esta (em, padrão 'este') não é monstruosa, põe qtd marcadores +1/+1 e ela fica monstruosa (CR 701.37); gat ev monstruosa = 'when it becomes monstrous'; olharMao: quem olha a mão de quem (quem = o jogador olhado; só informação, vai ao log); resolverCaso: este Caso fica resolvido (719.3; o 'Solved —' lê se {palavra:'solved'}); selar: esta Montaria fica selada até o fim do turno (702.171; a kw selar já dá a habilidade); tirarDoCombate: em deixa de atacar/bloquear (506.4) | fundir: exila esta e uma permanente que bate em f (sua, de que você é dono) e põe no campo a carta fundida (faces[0], forma fundir); virada/atacando valem para ela (Mishra); olharMao: quem olha a mão de quem (quem = o jogador olhado; só informação, vai ao log) | tirarDoCombate põe as que saíram em 'anterior'; vidaVira: a vida de quem vira qtd (119.5: ganha ou perde a diferença); semDanoCombate: em não causa dano de combate neste combate (Master of Cruelties)
   */
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
    | 'trocarAlvos'
    | 'duasPilhas'
    | 'limitarBloqueio'
    | 'trocarTexto'
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
    | 'desanexar'
    | 'fasear'
    | 'transformar'
    | 'efeitoTemporario'
    | 'gatilhoAtrasado'
    | 'reflexo'
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
    | 'popular'
    | 'incitar'
    | 'fundir'
    | 'tomarIniciativa'
    | 'aventurar'
    | 'monstruosidade'
    | 'olharMao'
    | 'resolverCaso'
    | 'selar'
    | 'tirarDoCombate'
    | 'vidaVira'
    | 'semDanoCombate';
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
   * mana: cores produzidas; 'qualquer', 'comandante' (identidade), ou lista de opções; 'deSeusTerrenos' = um tipo que um terreno seu poderia produzir (Incubation Druid); 'cadaCorSuas' = uma de cada cor entre as permanentes que você controla (Faeburrow Elder); 'doTerreno' (gatilho viraParaMana) = um tipo que aquele terreno produziu (Mirari's Wake); {coresEntre: filtro} = uma cor entre as das permanentes do filtro (Mox Amber)
   */
  prod?:
    | {
        coresEntre: RxFiltro;
      }
    | ('qualquer' | 'comandante' | 'refletida' | 'escolhida' | 'deSeusTerrenos' | 'cadaCorSuas' | 'doTerreno')
    | string[]
    | {
        cadaCor: RxFiltro;
      };
  de?: RxZona;
  para?: RxZona;
  /**
   * buscar/cavar/escolher: o que pode ser pego
   */
  f?: RxFiltro;
  virada?: boolean;
  atacando?: boolean;
  revelar?: boolean;
  /**
   * trocarTexto: o tipo de criatura que entra no lugar do escolhido em todo o texto e linha de tipo do afetado (New Blood: 'replacing all instances of one creature type with Vampire', CR 612.1/612.2)
   */
  novoTipo?: string;
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
   * gatilhoAtrasado; reflexo (CR 603.12): o gatilho "quando você fizer isso" (ev reflexo, com alvos/fx), que vai à pilha logo depois
   */
  quando?: RxGat;
  /**
   * escolher: o quê; tipoCarta = um tipo de card, ao entrar (subst emVez; opções em 'tipos', padrão artefato/criatura/encantamento/instantânea/feitiço: Cloud Key), lido no filtro tipo ['escolhido']
   */
  o?: 'tipoCriatura' | 'cor' | 'jogador' | 'numero' | 'carta' | 'modo' | 'tipo' | 'tipoCarta';
  escolhe?: {
    min?: number;
    max?: number;
    /**
     * só modos que esta fonte ainda não escolheu neste turno (Monument to Endurance)
     */
    naoRepeteNoTurno?: boolean;
    /**
     * custo a mais de cada modo escolhido, na ordem dos modos (Tiered: Cloud's Limit Break; Spree) — CR 601.2f
     */
    custoModos?: RxMana[];
    /**
     * Escalate: este custo a mais por modo escolhido além do primeiro (CR 702.120a; Collective Resistance)
     */
    escalar?: RxMana;
    maxSe?: {
      se?: RxCond;
      max?: number;
    };
  };
  modos?: RxFxs[];
  cada?:
    | RxJogador
    | RxFiltro
    | {
        alvo: number;
      };
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
   * efeitoTemporario: vale só para a próxima mágica que você conjurar (Mistrise Village: subst anulada)
   */
  proximaMagica?: boolean;
  /**
   * copiarMagica: pode escolher novos alvos
   */
  novoAlvo?: boolean;
  /**
   * marcador: remover em vez de pôr
   */
  tirar?: boolean;
  /**
   * marcador com f: para cada cor (W, U, B, R, G), um objeto de f daquela cor recebe o marcador; resultado = quantos objetos distintos receberam (Call the Spirit Dragons)
   */
  cadaCor?: true;
  /**
   * faseExtra: qual
   */
  fase?: 'combate' | 'principal' | 'turno';
  /**
   * animar: perde estas palavras-chave
   */
  tiraKw?: RxKw[];
  /**
   * anular: se anulou uma habilidade cuja fonte está no campo e bate f, a fonte perde todas as habilidades enquanto esta permanente estiver no campo (Tishana's Tidebinder; CR 613.1f)
   */
  perdeFonte?: {
    f: RxFiltro;
  };
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
   * op mover para campo: se ela fosse sair do campo, vai para o exílio em vez disso (desenterrar, CR 702.84a)
   */
  exilaAoSair?: boolean;
  /**
   * op buscar: as cartas achadas têm um tipo de terreno em comum (Myriad Landscape: "that share a land type")
   */
  tipoTerrenoComum?: boolean;
  /**
   * op jogar: conjura uma CÓPIA da carta (CR 707.12, Mizzix's Mastery); a carta fica onde está
   */
  copia?: boolean;
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
   * mover para o grimório: N-ésima a partir do topo ("fourth from the top" = 4, Lost to Legend)
   */
  posicao?: number;
  /**
   * mover para o campo: entra sem estes tipos ("It's an enchantment. (It's not a creature.)", Enduring Courage)
   */
  tiraTipo?: string[];
  /**
   * descartar ao acaso (Gamble) · também vale para escolher modos ao acaso (Outlaws' Merriment) · cavar: o resto vai em ordem aleatória (Empty the Laboratory, Thassa's Oracle)
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
    /**
     * põe 1 marcador deste tipo em cada uma que fica (Promise of Loyalty: 'vow')
     */
    marcaFicam?: string;
    /**
     * as que ficam não podem atacar você (quem resolve) nem seus planeswalkers enquanto tiverem o marcador de marcaFicam (Promise of Loyalty)
     */
    votoContra?: boolean;
  };
  /**
   * op ficha: cria qtd fichas PARA CADA jogador atacado, cada grupo atacando aquele jogador (Adeline, Ainok Strike Leader, Soaring Lightbringer)
   */
  porJogadorAtacado?: boolean;
  /**
   * op virar/efeito: não desvira no próximo passo de desvirar do controlador (Junk Winder + 2)
   */
  naoDesvira?: boolean;
  /**
   * copiarPermanente: o objeto COPIADO (em = quem vira a cópia, 707.2). op dano: o objeto que CAUSA o dano (padrão: esta carta). {alvo:N} = a criatura alvo (Chandra's Ignition); doEvento = o objeto do evento: a que entrou (Warstorm Surge) ou, no ev dano com 'recebe', a que RECEBEU o dano (Wrathful Raptors)
   */
  fonte?: RxObjeto;
  /**
   * op desanexar sem em: solta um anexo (f, padrão Equipamento) de uma permanente que bate neste filtro; quem faz escolhe ao resolver (Akiri). Depois, em anterior = de quem soltou (CR 701.3d)
   */
  presaA?: RxFiltro;
  /**
   * op buscar: no grimório do jogador alvo {alvo: N} em vez do seu (Knowledge Exploitation)
   */
  noDe?: RxObjeto;
  /**
   * op mover para o exílio: guarda que foi este objeto que exilou (607.2a), para o filtro exiladaPorEste depois
   */
  comEste?: boolean;
  /**
   * exila virada para baixo (406.3): ninguém vê, só quem olhou ao exilar (cavar: 'look at ... and exile face down', Lobelia) ou quem o efeito deixa; sem características no exílio (406.3a)
   */
  faceBaixo?: true;
  /**
   * op mover para o campo: entra com a face de trás (712.14): exilar e voltar transformada (Ajani, Welcome to … III), volta do cemitério transformada (Ojer Taq)
   */
  transformada?: boolean;
  /**
   * op virar com naoDesvira: NÃO vira, só impede de desvirar no próximo passo de desvirar do controlador (Fifty Feet of Rope: Tie Up)
   */
  soNaoDesvira?: boolean;
  /**
   * modificar com cores: 'vira [cor]' — perde as outras cores (105.3; Crimson Wisps); sem ele, cores é 'além das outras' (Liliana's Majesty)
   */
  trocaCor?: boolean;
  /**
   * descobrir: é a cascata (702.85a): qtd = valor de mana − 1 e a não conjurada vai ao fundo com as outras, em ordem aleatória (não vai à mão)
   */
  cascata?: boolean;
  /**
   * animar: os subtipos de criatura passam a ser só os de sub (perde os outros, 205.1b: "It's a green Mutant… loses its other creature types" — The Master, Transcendent)
   */
  soSub?: boolean;
  /**
   * cavar: no máximo uma carta de cada subtipo do f.sub ("an Angel card, a Demon card, and/or a Dragon card": Kaalia, Zenith Seeker)
   */
  umDeCada?: boolean;
  /**
   * buscar: as cartas pegas têm nomes diferentes entre si ("that each have different names": Tiamat)
   */
  nomesDiferentes?: boolean;
  /**
   * animar: supertipos a mais ("becomes a legendary 6/6…", Cacophony Unleashed) | copiarPermanente: supertipos além dos copiados ("it's legendary in addition to its other types": Sarkhan)
   */
  super?: string[];
  /**
   * com pagando {mana:{x:1}}: "you may pay {X}, where X is less than or equal to N" — você escolhe o X (0…N); o efeito lê o X pago (qtd 'X'; Well of Lost Dreams)
   */
  xAte?: RxQtd;
  /**
   * copiarPermanente: "except its name is [este]" (707.9b; Sunfrill Imitator, Sarkhan Soul Aflame)
   */
  mantemNome?: boolean;
  /**
   * copiarPermanente: "and it has this ability" — fica com as habilidades desencadeadas impressas dela (Sunfrill Imitator)
   */
  mantemGat?: boolean;
  /**
   * cavar: pega até UM de cada subtipo da lista (Kaalia, Zenith Seeker: 'an Angel, a Demon, and/or a Dragon')
   */
  umPorSub?: string[];
  /**
   * op modificar (em 'este', dura fimDoTurno): ganha as habilidades ativadas que o alvo tem na resolução (Quicksilver Elemental)
   */
  habilDe?: RxObjeto;
  /**
   * copiarMagica (em doEvento, mágica de um alvo só que mira esta): uma cópia para cada outra criatura sua que ela poderia mirar, cada cópia mirando uma delas (Zada, Hedron Grinder)
   */
  cadaOutroAlvo?: true;
  /**
   * ficha: entra bloqueando o atacante do evento 'bloqueia' (Brimaz: "that's blocking that creature")
   */
  bloqueando?: boolean;
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
   * com copiaDe: tipos de carta além dos da cópia (707.9b: "a 1/1 Soldier creature in addition to its other types")
   */
  maisTipos?: string[];
  /**
   * com copiaDe: subtipos além dos da cópia (707.9b)
   */
  maisSub?: string[];
  /**
   * cópia sem o supertipo lendário
   */
  naoLendaria?: boolean;
  /**
   * gatilhos da ficha (Circle of Power, Cornered by Black Mages)
   */
  gat?: RxGat[];
  /**
   * estáticas da própria ficha; afeta 'este' = a ficha (Construct +1/+1 por artefato: continuo; Gnome Soldier P/R = artefatos e/ou criaturas: ptDefinido)
   */
  est?: RxEst[];
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
  /**
   * doEvento: é o turno do jogador do evento ("draws a card during their turn": Wedding Ring)
   */
  turno?: 'seu' | 'deOutro' | 'doEvento';
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
  conjuradaCom?:
    'sobrecarga' | 'kicker' | 'flashback' | 'cemiterio' | 'exilio' | 'madness' | 'evoke' | 'alternativo' | 'impending';
  /**
   * Addendum: ESTA mágica foi conjurada durante a fase principal do controlador (implica turno seu; vale o momento de conjurar, não o de resolver)
   */
  conjuradaNaPrincipal?: boolean;
  /**
   * a contagem q compara (min/max/igual: número ou outra contagem — Thassa's Oracle: devoção ≥ cartas no grimório)
   */
  conta?: {
    q: RxQtd;
    min?: RxQtd;
    max?: RxQtd;
    igual?: RxQtd;
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
   * condição nomeada: metalcraft, blessing, maxspeed…; solved (este Caso está resolvido, 719.3)
   */
  palavra?: string;
  /**
   * você é o monarca
   */
  monarca?: boolean;
  /**
   * existe um monarca na partida (false = "if there is no monarch": Crown of Gondor)
   */
  haMonarca?: boolean;
  /**
   * true: você tem um Portador do Anel (o Anel te tentou); 'este': esta é o seu Portador (Frodo)
   */
  portadorDoAnel?: boolean | 'este';
  /**
   * oponente controla mais terrenos que você: 'algum' = algum oponente (Land Tax, Loyal Warhound); 'doEvento' = o jogador do evento (Archaeomancer's Map)
   */
  maisTerrenosOponente?: 'algum' | 'doEvento';
  /**
   * é a primeira fase de combate do turno (Genji Glove, Karlach)
   */
  primeiroCombate?: boolean;
  /**
   * é a fase de combate, de qualquer jogador (Marisi: 'can't cast spells during combat')
   */
  emCombate?: boolean;
  /**
   * é a fase principal (1 ou 2) do controlador (Moraug); só 'turno seu' = cond turno
   */
  fasePrincipal?: boolean;
  /**
   * o modo escolhido quando a permanente entrou (Mirrodin Besieged 'Mirran'/'Phyrexian', Windcrag Siege, Struggle); a escolha = op escolher o 'modo' ao entrar
   */
  modoEscolhido?: string;
  /**
   * você tem a iniciativa (CR 725)
   */
  temIniciativa?: boolean;
  /**
   * você desceu neste turno: uma carta de permanente foi para o seu cemitério, de qualquer zona (Brass's Tunnel-Grinder)
   */
  desceu?: boolean;
  /**
   * você completou uma masmorra (309.7) nesta partida; {nome} = aquela masmorra (Tomb of Annihilation)
   */
  completouMasmorra?:
    | boolean
    | {
        nome: string;
        /**
         * true = NÃO completou aquela masmorra (Acererak)
         */
        nao?: boolean;
      };
  /**
   * o jogador do evento (quem levou o dano) tem mais cartas na mão / terrenos / vida que cada outro jogador (Battle Angels of Tyr)
   */
  eventoMais?: 'mao' | 'terrenos' | 'vida';
  /**
   * a condição de dentro NÃO vale ("unless you have the city's blessing": {nao:{palavra:'blessing'}}; Wayward Swordtooth)
   */
  nao?: RxCond;
}

export interface RxKw {
  /**
   * replicar {custo}: custo adicional pago N vezes ao conjurar; ao conjurar, copia N vezes (CR 702.56); comecaNoCampo: começa o jogo no campo se estiver na mão inicial (Leylines, CR 103.6a); sobrecarga: o motor troca 'alvo' por 'cada' (CR 702.96); aventura/loucura/flashback idem pela regra, não pelo fx
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
    | 'delve'
    | 'loucura'
    | 'milagre'
    | 'reconfigurar'
    | 'entraPreparada'
    | 'segundoDividido'
    | 'ninjutsu'
    | 'prever'
    | 'rondar'
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
    | 'selar'
    | 'investida'
    | 'fabricar'
    | 'posVida'
    | 'cascata'
    | 'caminhadaTerreno'
    | 'armaduraUmbra'
    | 'corpo-a-corpo'
    | 'evoluir'
    | 'persistir'
    | 'imortal'
    | 'desaparecer'
    | 'rebote'
    | 'dobra'
    | 'eternizar'
    | 'agregar'
    | 'miriade'
    | 'mobilizar'
    | 'aflicao'
    | 'eco'
    | 'bis'
    | 'prole'
    | 'iminente'
    | 'concessao'
    | 'capitulo'
    | 'classe'
    | 'entraComMarcador'
    | 'tumulto'
    | 'fusao'
    | 'intimidar'
    | 'decaida'
    | 'infectar'
    | 'fuga'
    | 'prototipo'
    | 'comecaNoCampo'
    | 'converter'
    | 'dragar'
    | 'suspender'
    | 'replicar';
  custo?: RxMana;
  /**
   * prototipo (CR 702.160): P/R do protótipo; custo = o custo dele; cores = as do custo (ou 'cores')
   */
  pt?: number[];
  cores?: string;
  /**
   * dragar: N (CR 702.52a: no cemitério, troca a compra por moer N e devolver esta carta à mão; só com ≥N no grimório, 702.52b). suspender: N marcadores de tempo, com custo (702.62a: da mão, pague o custo e exile com N marcadores; na sua manutenção tira 1; ao tirar o último, conjura sem pagar o custo de mana; criatura ganha ímpeto). desaparecer: N (702.63a: entra com N marcadores de tempo; na sua manutenção, se tem, tira 1; ao tirar o último, sacrifique)
   */
  n?: number;
  /**
   * proteção de/resguardo: cor (W/U/B/R/G, ou várias: 'WB'), 'coresDoAnterior' (as cores do que o efeito anterior moveu, Éowyn), 'cadaCor' (de cada cor: uma palavra só, não 5), 'tudo', tipo
   */
  de?: string;
  tipo?: string;
  f?: RxFiltro;
  /**
   * resguardo com custo que não é mana (pagar vida)
   */
  pagar?: RxCustoAtv;
  /**
   * fuga: quantas OUTRAS cartas do seu cemitério exilar
   */
  exilar?: number;
  /**
   * fuga: 'foge com' esses marcadores (702.138c)
   */
  comMarc?: {
    [k: string]: number;
  };
  /**
   * chute com {X}: o X anunciado com chute é pelo menos isto ("X can't be 0": Thieving Skydiver)
   */
  xMin?: number;
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
  /**
   * "This ability costs {1} less to activate for each …": tira N do genérico desta habilidade (CR 601.2f/602.2b; Voldaren Estate, Otawara)
   */
  reduz?: RxQtd;
}

export interface RxGat {
  /**
   * destranca: "when you unlock this door" — no texto da porta (face) de uma Room; dispara quando essa porta fica destrancada, ao entrar ou pagando o custo (709.5h); portador: você escolhe uma criatura como Portador do Anel (701.54a; jog: de quem, padrão você); ativa: um jogador (jog) ativa uma habilidade que não é de mana de um objeto que bate em quem (602.2, Runic Armasaur); naoBloqueada: atacante sem bloqueador declarado (509.3g, 'attacks and isn't blocked'; jog/doEvento = o defensor; aJogador: só quem ataca um jogador)
   */
  ev:
    | 'destranca'
    | 'cicla'
    | 'desvira'
    | 'jogaTerreno'
    | 'prolifera'
    | 'entra'
    | 'morre'
    | 'vaiCemiterio'
    | 'sai'
    | 'fase'
    | 'ataca'
    | 'atacantesDeclarados'
    | 'reflexo'
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
    | 'ficaMonstruosa'
    | 'zonaVarios'
    | 'capitulo'
    | 'saiCemiterio'
    | 'fichaCriada'
    | 'viraParaMana'
    | 'descarta'
    | 'moe'
    | 'explora'
    | 'completaMasmorra'
    | 'sala'
    | 'tomaIniciativa'
    | 'nivel'
    | 'monstruosa'
    | 'portador'
    | 'ativa'
    | 'gasta'
    | 'danoPrevenido'
    | 'naoBloqueada';
  /**
   * com ev 'sai': só quando NÃO foi para o cemitério vindo do campo por morte (Dour Port-Mage)
   */
  naoMorre?: boolean;
  /**
   * objeto do evento (criatura que entra/ataca/morre, mágica conjurada…)
   */
  quem?: RxFiltro;
  /**
   * jogador do evento (quem conjura/compra/perde vida; quem leva dano; marcadorPosto: quem pôs)
   */
  jog?: RxJogador;
  /**
   * ev fase
   */
  passo?: 'manutencao' | 'compra' | 'inicioCombate' | 'final' | 'principal1' | 'principal2' | 'fimCombate';
  /**
   * ev fase: no turno de quem; oponenteEscolhido (só gatilho atrasado): o oponente escolhido quando o atrasado foi criado (Faramir)
   */
  deQuem?: 'voce' | 'cadaJogador' | 'oponente' | 'oponenteEscolhido';
  combate?: boolean;
  /**
   * dano/danoUmaVez: o dano foi num jogador; naoBloqueada: a criatura atacava um jogador
   */
  aJogador?: boolean;
  /**
   * o dano é a um jogador ou planeswalker (Neheb)
   */
  aJogadorOuPw?: boolean;
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
   * capitulo: número do capítulo da saga; gasta: N de "whenever you expend N" (a N-ésima mana gasta em mágicas no turno; Wandertale Mentor)
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
   * ev conjura: só a primeira mágica daquele jogador no turno que bate o quem (Esper Sentinel: "their first noncreature spell each turn")
   */
  primeiraNoTurno?: boolean;
  /**
   * zona de origem do objeto que mudou de zona
   */
  de?: RxZona;
  /**
   * entra: não vale para o que um efeito desta permanente pôs no campo ("if it wasn't put onto the battlefield with this ability": Kodama of the East Tree)
   */
  naoPorEste?: boolean;
  /**
   * entra com de: vale também a que foi conjurada daquela zona ("entered from a graveyard or was cast from a graveyard": Kotis)
   */
  ouConjurada?: boolean;
  /**
   * "from anywhere other than …"
   */
  naoDe?: RxZona;
  /**
   * conjura: só se a mana desta fonte pagou a mágica ("using mana produced by", Tecutlan)
   */
  comManaDe?: 'este';
  /**
   * ev explora: true = revelou terreno ("explores a land card"), false = revelou não-terreno (Nicanzil); grimório vazio não dispara nenhum dos dois
   */
  revelaTerreno?: boolean;
  /**
   * ev dano: quem RECEBE o dano ('quem' = a fonte). Enrage/'é causado dano a esta' → recebe {este: true} (Apex Altisaur, Metropolis Reformer)
   */
  recebe?: RxFiltro;
  /**
   * ev compra: exceto a primeira carta que o jogador compra no passo de compra dele (Orcish Bowmasters, Bard)
   */
  naoPrimeira?: boolean;
  /**
   * ev alvoDe: só quando o que mira é uma habilidade ATIVADA ("becomes the target of an activated ability", Professor Hojo)
   */
  porAtivada?: boolean;
}

export interface RxEst {
  /**
   * oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew); darRondar: as mágicas suas que batem em afeta têm rondar com o custo 'custo' (Hunting Velociraptor, 702.76); darRondar: as mágicas suas que batem em afeta têm rondar com este custo (Hunting Velociraptor) | manaComoQualquerCor (afeta 'este', cor): a mana daquela cor paga qualquer cor nos custos das habilidades ativadas desta (Quicksilver Elemental); oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew) | naoPerdeJogo (afeta voce): você não pode perder o jogo e seus oponentes não podem vencer (Platinum Angel; dado por modificar dura sempre: The Book of Exalted Deeds); oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew) | atacaSozinha (afeta 'este'): só pode atacar sozinha (506.5, 508.1c; Master of Cruelties) | naoPodeAtacar com contra num efeitoTemporario com em: aquelas não atacam você nem seus planeswalkers (Illusionist's Gambit) | darReplicar (afeta = filtro da mágica): as mágicas suas que batem têm replicar com custo = o custo de mana delas (Hatchery Sliver, 702.56); oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew); darRondar: as mágicas suas que batem em afeta têm rondar com o custo 'custo' (Hunting Velociraptor, 702.76); darRondar: as mágicas suas que batem em afeta têm rondar com este custo (Hunting Velociraptor) | manaComoQualquerCor (afeta 'este', cor): a mana daquela cor paga qualquer cor nos custos das habilidades ativadas desta (Quicksilver Elemental); oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew) | naoPerdeJogo (afeta voce): você não pode perder o jogo e seus oponentes não podem vencer (Platinum Angel; dado por modificar dura sempre: The Book of Exalted Deeds); oponentesNaoProcuram: mágicas e habilidades dos seus oponentes não fazem o controlador delas procurar no grimório (Ashiok, Dream Render); darLoucura: as cartas de afeta que não estão no campo têm loucura com custo = o custo de mana delas (Falkenrath Gorger); naoPodeAtivar: os objetos de 'afeta' não ativam habilidades (Linvala, Keeper of Silence; Myrel); 'semMana' em nenhum caso: escrever na falta; deveBloquear: os afetados bloqueiam se puderem (Brutal Hordechief), e com 'atacante' bloqueiam aquele atacante (Fighter Class, Tolsimir) equiparComoInstantanea: no seu turno, equipar na velocidade de instantânea; primeiroEquiparGratis: o 1º equipar de cada turno seu custa {0} (Forge Anew)
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
    | 'naoPerdeJogo'
    | 'maxAtacantes'
    | 'protecaoJogador'
    | 'ptDefinido'
    | 'danoNaoPrevenivel'
    | 'podeJogar'
    | 'podeOlhar'
    | 'dobraGatilho'
    | 'ataqueCusta'
    | 'bloqueioCusta'
    | 'naoPodeAtivar'
    | 'ganhaAtivadas'
    | 'deveBloquear'
    | 'darFuga'
    | 'darRetrace'
    | 'darBis'
    | 'semRegraLenda'
    | 'radiacaoGanhaVida'
    | 'darLoucura'
    | 'oponentesNaoProcuram'
    | 'custoProibido'
    | 'naoGanhaVida'
    | 'equiparComoInstantanea'
    | 'primeiroEquiparGratis'
    | 'darRondar'
    | 'manaComoQualquerCor'
    | 'atacaSozinha'
    | 'darReplicar';
  afeta?: RxFiltro | RxJogador | ('este' | 'equipada');
  p?: RxQtd;
  r?: RxQtd;
  /**
   * continuo com tipo: P/R base [p, r]; 'vm' = cada afetado com P/R base iguais ao seu valor de mana (Starfield of Nyx, March of the Machines)
   */
  pt?: unknown[] | 'vm';
  kw?: RxKw[];
  tipo?: string[];
  habil?: {
    atv?: unknown[];
    gat?: unknown[];
  };
  qtd?: RxQtd;
  /**
   * ataqueCusta/bloqueioCusta: quanto o controlador paga por criatura atacante/bloqueadora (vezes qtd, se houver: Sphere of Safety). Pago ao fechar a declaração (CR 508.1d/h, 509.1d/f); quem não paga não ataca/bloqueia
   */
  custo?: RxMana;
  se?: RxCond;
  /**
   * CR 613: '1','2','3','4','5','6','7a'…'7d'; o conversor preenche
   */
  camada?: string;
  de?: RxZona;
  /**
   * podeJogar de 'exilio': a mágica conjurada por esta permissão paga vida igual ao valor de mana em vez do custo de mana (Valgavoth, Terror Eater; 118.9, 119.4)
   */
  pagarVida?: true;
  /**
   * podeJogar: a mágica conjurada por esta permissão vai para o exílio em vez do cemitério (Kess, Dissident Mage) | podeJogar: a mágica conjurada assim vai para o exílio em vez do cemitério (Kess: 'If a spell cast this way would be put into your graveyard, exile it instead')
   */
  exilaAoSair?: boolean;
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
   * continuo: os afetados perdem estas palavras-chave (Colossus Hammer: "and loses flying")
   */
  tiraKw?: RxKw[];
  /**
   * continuo: os afetados perdem todas as habilidades (CR 613.1f, camada 6; Poppet Factory). O que foi dado depois (timestamp maior, 613.7) fica
   */
  tiraTudo?: true;
  /**
   * continuo afeta equipada: os tipos de criatura viram só os de sub ("is a black Zombie", Nim Deathmantle; CR 205.1b)
   */
  trocaSub?: boolean;
  /**
   * naoPodeAtacar/ataqueCusta: o defensor (jogador e/ou permanente)
   */
  contra?: {
    jog?: RxJogador;
    f?: RxFiltro;
  };
  /**
   * aumentaCusto/reduzCusto: só mágicas/habilidades que miram o afetado (reduzCusto aoMirar: só com deHabil, Professor Hojo)
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
  /**
   * deveBloquear: o atacante que o afetado tem de bloquear se puder (doEvento = a criatura que atacou)
   */
  atacante?: RxObjeto;
  /**
   * darFuga: exilar N outras do cemitério (Underworld Breach) · podeJogar: custo a mais de exilar N outras do cemitério (Kotis)
   */
  exilar?: number;
  /**
   * custoProibido: o que nenhum jogador pode pagar para conjurar mágicas ou ativar habilidades (Angel of Jubilation: vida e sacrificar criatura; inclui a vida do mana phyrexiano)
   */
  proibe?: ('vida' | 'sacrificarCriatura')[];
  /**
   * condição do jogador afetado (naoPodeConjurar: o jogador; naoPodeAtacar: o controlador da criatura) — Angelic Arbiter: 'each opponent who cast a spell / attacked with a creature this turn'
   */
  seJog?: 'atacouNoTurno' | 'conjurouNoTurno';
  /**
   * reduzCusto: o custo de mana não fica abaixo de N manas (Forensic Gadgeteer: 'can't reduce the mana in that cost to less than one mana')
   */
  minimo?: number;
  /**
   * manaComoQualquerCor: a cor da mana que vale por qualquer cor ("spend blue mana as though it were mana of any color")
   */
  corMana?: 'W' | 'U' | 'B' | 'R' | 'G';
  /**
   * ganhaAtivadas: a mana paga como se fosse de qualquer cor nos custos das habilidades ganhas (Drana and Linvala: 'You may spend mana as though it were mana of any color to activate those abilities', CR 609.4b)
   */
  qualquerCor?: boolean;
  /**
   * reduzCusto aoMirar: só a primeira habilidade ativada que você ativa no seu turno mirando o afetado (Professor Hojo)
   */
  primeiraNoSeuTurno?: boolean;
}

/**
 * substituição (CR 614): quando o evento ev for acontecer com quem, faz 'muda' ou 'emVez'
 */
export interface RxSubst {
  /**
   *  ganhaVida: só o GANHO de vida (jog + muda soma/mult: Angel of Vitality, Bilbo, The Wind Crystal); vidaMuda pega ganho e perda · moer: "would mill" (jog + muda.soma: mói N a mais — The Water Crystal) · explorar: quem (a criatura que exploraria) + muda.mult: explora N vezes (Topography Tracker)
   */
  ev:
    | 'entra'
    | 'ficha'
    | 'marcador'
    | 'morre'
    | 'vaiCemiterio'
    | 'dano'
    | 'compra'
    | 'anulada'
    | 'vidaMuda'
    | 'ganhaVida'
    | 'moer'
    | 'explorar';
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
    /**
     * dano (jog voce): o dano que deixaria sua vida abaixo de 1 a deixa em 1 (Serra the Benevolent, Worship)
     */
    vidaMin?: 1;
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
     * com prevenir: cria uma desta ficha para cada 1 de dano prevenido assim (Inkshield, CR 615)
     */
    fichaPorDano?: RxToken;
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
  /**
   * dano com muda.prevenir: efeitos da própria substituição depois de prevenir; conta resultado = o dano prevenido (Bloatfly Swarm)
   */
  depois?: RxFxs;
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

/**
 * UMA forma de contar (27/11, src/motor/contagem.ts): de = de quem/onde, o = o que se lê, junta = como junta vários. Ex.: poder deste = {de:'este', o:'poder'}; soma do poder das suas criaturas = {de:{f:{tipo:['Creature'],ctrl:'voce',zona:'campo'}}, o:'poder', junta:'soma'}; maior nº descartado por um jogador = {de:'lembradas', o:'quantos', junta:'maiorPorDono'}. Nunca criar nome novo: combinar de/o/junta.
 */
export interface RxContagem {
  /**
   * este | {alvo:N} | {f:filtro} | voce | oponentes | jogadores | turno (o que aconteceu neste turno) | combate | evento (o do gatilho) | lembradas (as do efeito anterior) | sacrificadas (custo) | cada (o da vez no repetirCada) | X | resultado | escolhido | se
   */
  de:
    | (
        | 'atacado'
        | 'este'
        | 'voce'
        | 'turno'
        | 'combate'
        | 'oponentes'
        | 'jogadores'
        | 'X'
        | 'resultado'
        | 'escolhido'
        | 'lembradas'
        | 'evento'
        | 'sacrificadas'
        | 'cada'
        | 'tipoMaisComum'
        | 'se'
        | 'custo'
      )
    | {
        alvo: number;
      }
    | {
        f: RxFiltro;
      };
  /**
   * o que se lê; sem o = o próprio valor (X, resultado, escolhido, se); poderAcimaDeste (de {alvo:N}) = poder do alvo menos o deste, 0 se não for maior (Conformer Shuriken); manaGasta (de evento conjura): a mana gasta para conjurar (Liberator); tentacoes (de voce): quantas vezes o Anel te tentou nesta partida; jogadores (de: evento) = quantos jogadores o dano de combate do disparo único (danoUmaVez) feriu; excesso (de: turno; quem oponentes) = quantas vezes uma criatura/planeswalker sua (ou dos oponentes) levou dano excedente neste turno (120.10, Rith); aoCemiterio (de turno): cartas suas postas no seu cemitério vindas da mão ou do grimório neste turno (Welcome the Dead); cores (de voce): nº de cores da identidade dos seus comandantes (War Room); alvos (de evento, com f): quantos alvos distintos da mágica do evento batem no filtro f (Arcee: "put that many +1/+1 counters"); marcadores (de custo): os tirados no custo "remove one or more" (Arcee)
   */
  o?:
    | 'quantos'
    | 'poder'
    | 'resist'
    | 'vm'
    | 'grimorio'
    | 'vida'
    | 'mao'
    | 'cores'
    | 'marcadores'
    | 'kicker'
    | 'coresPagas'
    | 'vidaInicial'
    | 'devocao'
    | 'dominio'
    | 'impostoCmd'
    | 'turnos'
    | 'magias'
    | 'descartes'
    | 'ataques'
    | 'resolvidas'
    | 'vidaGanha'
    | 'compras'
    | 'vidaPerdida'
    | 'resolucoesDestaHab'
    | 'oponentesAtacados'
    | 'sacrificadas'
    | 'manaGasta'
    | 'entraram'
    | 'atacantes'
    | 'atacantesEmVoce'
    | 'maior'
    | 'dano'
    | 'nome'
    | 'tipos'
    | 'poderAcimaDeste'
    | 'tentacoes'
    | 'cemiterio'
    | 'jogadores'
    | 'excesso'
    | 'aoCemiterio'
    | 'alvos';
  /**
   * só os que batem — turno/entraram (Éowyn, Shieldmaiden: outro Humano seu); turno/sacrificadas ("if you sacrificed a Food this turn": {sub:['Food']})
   */
  f?: RxFiltro;
  /**
   * vários objetos: soma | maior | diferentes | maiorPorDono (sem junta = quantos são)
   */
  junta?: 'soma' | 'maior' | 'maiorPorDono' | 'diferentes';
  /**
   * o: marcadores — tipo do marcador ('+1/+1', 'lore', 'energy', 'poison'…); sem marc = todos
   */
  marc?: string;
  /**
   * o: devocao — cores (W U B R G) ou 'escolhida'
   */
  cores?: string;
  /**
   * de: turno — de quem (padrão: você; cadaAtual = o jogador da vez no repetirCada)
   */
  quem?: 'oponentes' | 'cadaAtual';
  /**
   * de: se — condição (kicked, promisedgift, morbid…)
   */
  cond?: string;
  sim?: number;
  nao?: number;
  /**
   * de: jogadores, o: cemiterio — quantos jogadores têm pelo menos min cartas no cemitério (Master of Lake-town)
   */
  min?: number;
}
