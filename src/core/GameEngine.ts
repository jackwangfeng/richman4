import {
  GameState, GamePhase, PropertyState, PlayerState,
  DiceResult, TileType, GameMessage, DecisionOption, AIPersonality,
  CardType, Stock, GeminiGameContext,
} from '../types';
import { TILE_DEFS, TOTAL_TILES, GO_SALARY, TAX_AMOUNT, CHARACTER_DEFS, STARTING_MONEY, CARD_DEFS, MAX_CARDS, CARD_CHANCE, STOCK_DEFS } from '../constants';
import { rollDice } from './Dice';
import { AI } from './AI';
import { GeminiAI } from './GeminiAI';
import { GeminiConfigManager } from './GeminiConfigManager';

type EventCallback = (event: string, data?: any) => void;

export class GameEngine {
  state: GameState;
  onDelay: (() => void) | null = null;
  onWaitingForInput: (() => void) | null = null;
  private listeners: EventCallback[] = [];
  private resolveDecision: ((action: string) => void) | null = null;
  private resolveCharacterSelect: (() => void) | null = null;

  constructor() {
    this.state = this.createInitialState();
  }
  private createInitialState(): GameState {
    const properties: PropertyState[] = TILE_DEFS.map(() => ({
      ownerIndex: -1,
      buildings: 0,
    }));
    // Initialize stocks with random starting prices
    const stocks: Stock[] = STOCK_DEFS.map(s => ({
      ...s,
      price: s.price + Math.floor(Math.random() * 40) - 20,
    }));
    return {
      phase: GamePhase.CHARACTER_SELECT,
      currentPlayerIndex: 0,
      players: [],
      properties,
      dice: null,
      messages: [{ text: '请选择你的角色', timestamp: Date.now() }],
      decisionOptions: [],
      winner: -1,
      turnCount: 0,
      stocks,
    };
  }

  handleCharacterSelect(charIndex: number) {
    if (this.state.phase !== GamePhase.CHARACTER_SELECT) return;

    const selected = CHARACTER_DEFS[charIndex];
    const remaining = CHARACTER_DEFS.filter((_, i) => i !== charIndex);
    // Shuffle remaining for AI
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    const personalities = [AIPersonality.AGGRESSIVE, AIPersonality.CONSERVATIVE];
    this.state.players = [
      {
        index: 0, name: selected.name, color: selected.color,
        money: STARTING_MONEY, position: 0, inJail: false, jailTurns: 0,
        bankrupt: false, isHuman: true, autoPlay: false, personality: AIPersonality.GEMINI, characterId: selected.id,
        cards: [], immuneTurns: 0, stocks: {}, frozenTurns: 0,
      },
      ...remaining.map((ch, i) => {
        let personality;
        if (i === remaining.length - 1) {
          // 确保最后一个AI玩家始终使用Gemini人格
          personality = AIPersonality.GEMINI;
        } else {
          personality = personalities[i % personalities.length];
        }
        return {
          index: i + 1, name: ch.name, color: ch.color,
          money: STARTING_MONEY, position: 0, inJail: false, jailTurns: 0,
          bankrupt: false, isHuman: false, autoPlay: false, personality, characterId: ch.id,
          cards: [] as CardType[], immuneTurns: 0, stocks: {} as Record<string, number>, frozenTurns: 0,
        };
      }),
    ];

    this.state.phase = GamePhase.WAITING;
    this.emit('characterSelected', { charIndex });
    this.addMessage(`你选择了 ${selected.name}！游戏开始！`, '#f1c40f');

    if (this.resolveCharacterSelect) {
      const resolve = this.resolveCharacterSelect;
      this.resolveCharacterSelect = null;
      resolve();
    }
  }

  setupPlayers(configs: { name: string; characterId: string; isHuman: boolean; personality: AIPersonality | null }[]) {
    this.state.players = configs.map((cfg, i) => ({
      index: i,
      name: cfg.name,
      color: CHARACTER_DEFS.find(c => c.id === cfg.characterId)?.color || '#888',
      money: STARTING_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      bankrupt: false,
      isHuman: cfg.isHuman,
      autoPlay: false,
      personality: cfg.personality || AIPersonality.GEMINI,
      characterId: cfg.characterId,
      cards: [] as CardType[],
      immuneTurns: 0,
      stocks: {} as Record<string, number>,
      frozenTurns: 0,
    }));
    this.state.phase = GamePhase.WAITING;
    this.state.messages = [{ text: '游戏开始！', timestamp: Date.now(), color: '#f1c40f' }];
  }

  toggleAutoPlay(playerIndex: number) {
    const player = this.state.players[playerIndex];
    if (player && player.isHuman) {
      player.autoPlay = !player.autoPlay;
      const status = player.autoPlay ? '开启' : '关闭';
      this.addMessage(`${player.name} ${status}托管模式`, '#9b59b6');
      this.emit('autoPlayToggled', { playerIndex, autoPlay: player.autoPlay });

      // If it's currently this player's turn and autoPlay just enabled, trigger AI action
      if (player.autoPlay && this.state.currentPlayerIndex === playerIndex) {
        this.triggerAutoAction();
      }
    }
  }

  private async triggerAutoAction() {
    const player = this.currentPlayer;
    if (!player.isHuman || !player.autoPlay) return;

    if (this.state.phase === GamePhase.WAITING && this.resolveDecision) {
      await this.delay(500);
      this.handleAction('roll');
    }
    else if (this.state.phase === GamePhase.PLAYER_DECISION && this.resolveDecision) {
      await this.delay(800);
      const action = await this.getAutoDecision(player);
      this.handleAction(action);
    }
  }

  private async getAutoDecision(player: PlayerState): Promise<string> {
    const options = this.state.decisionOptions;
    if (options.length === 0) return 'pass';

    // 托管模式或者GEMINI人格都使用Gemini AI
    if (player.autoPlay || player.personality === AIPersonality.GEMINI) {
      return await this.getGeminiDecision(player, options);
    }

    const buyOption = options.find(o => o.action === 'buy');
    if (buyOption) {
      const tileIndex = player.position;
      if (AI.shouldBuy(player, tileIndex, this.state.properties)) {
        return 'buy';
      }
      return 'pass';
    }

    const buildOption = options.find(o => o.action === 'build');
    if (buildOption) {
      const tileIndex = player.position;
      if (AI.shouldBuild(player, tileIndex, this.state.properties)) {
        return 'build';
      }
      return 'pass';
    }

    return options[0].action;
  }

  private async getGeminiDecision(player: PlayerState, options: DecisionOption[]): Promise<string> {
    const configManager = GeminiConfigManager.getInstance();
    console.log('[GameEngine] getGeminiDecision called, player:', player.name, 'autoPlay:', player.autoPlay, 'personality:', player.personality);
    console.log('[GameEngine] isConfigured:', configManager.isConfigured(), 'apiKey:', configManager.getApiKey());
    
    if (!configManager.isConfigured()) {
      this.addMessage(`Gemini API未配置，使用默认AI策略`, '#e74c3c');
      return options[0].action;
    }

    const config = configManager.getConfig();
    const geminiAI = new GeminiAI(config);

    let decisionType: 'buy' | 'build' | 'roll' | 'card' | 'stock' | 'jail' | 'preTurn' = 'roll';
    let tileIndex: number | undefined;

    if (options.find(o => o.action === 'buy')) {
      decisionType = 'buy';
      tileIndex = player.position;
    } else if (options.find(o => o.action === 'build')) {
      decisionType = 'build';
      tileIndex = player.position;
    } else if (options.find(o => o.action.startsWith('useJailCard') || o.action.startsWith('payBail') || o.action.startsWith('rollEscape'))) {
      decisionType = 'jail';
    } else if (options.find(o => o.action.startsWith('useCard_') || o.action.startsWith('viewStocks'))) {
      decisionType = 'preTurn';
    } else if (options.find(o => o.action.startsWith('buyStock_') || o.action.startsWith('sellStock_'))) {
      decisionType = 'stock';
    }

    const context: GeminiGameContext = {
      player,
      gameState: this.state,
      decisionContext: {
        type: decisionType,
        options,
        tileIndex
      }
    };

    try {
      const decision = await geminiAI.makeDecision(context);
      this.addMessage(`Gemini AI决策: ${decision.reasoning} (置信度: ${Math.round(decision.confidence * 100)}%)`, '#3498db');
      
      const validAction = options.find(o => o.action === decision.action);
      return validAction ? decision.action : options[0].action;
    } catch (error) {
      console.error('Gemini AI decision failed:', error);
      this.addMessage(`Gemini AI调用失败，使用默认策略`, '#e74c3c');
      return options[0].action;
    }
  }

  on(cb: EventCallback) {
    this.listeners.push(cb);
  }

  private emit(event: string, data?: any) {
    for (const cb of this.listeners) cb(event, data);
  }

  addMessage(text: string, color?: string) {
    this.state.messages.push({ text, timestamp: Date.now(), color });
    if (this.state.messages.length > 50) this.state.messages.shift();
  }

  get currentPlayer(): PlayerState {
    return this.state.players[this.state.currentPlayerIndex];
  }

  private activePlayers(): PlayerState[] {
    return this.state.players.filter(p => !p.bankrupt);
  }

  // Main turn execution
  async executeTurn(): Promise<void> {
    const player = this.currentPlayer;
    if (player.bankrupt) {
      this.nextPlayer();
      return;
    }

    // 回合开始时递减免租回合
    if (player.immuneTurns > 0) {
      player.immuneTurns--;
      if (player.immuneTurns === 0) {
        this.addMessage(`${player.name} 的免租效果已结束`, '#9b59b6');
      }
    }

    // 回合开始时处理冰冻状态
    if (player.frozenTurns > 0) {
      player.frozenTurns--;
      this.addMessage(`${player.name} 被冰冻，无法行动！`, '#3498db');
      this.state.phase = GamePhase.TURN_END;
      this.emit('phaseChange', GamePhase.TURN_END);
      await this.delay(500);
      this.updateStockPrices();
      this.checkGameOver();
      if ((this.state.phase as GamePhase) !== GamePhase.GAME_OVER) this.nextPlayer();
      return;
    }

    this.state.phase = GamePhase.WAITING;
    this.emit('phaseChange', GamePhase.WAITING);

    // 回合开始时可以使用卡片或交易股票（仅人类玩家且非托管）
    if (player.isHuman && !player.autoPlay) {
      await this.handlePreTurnActions(player);
    } else {
      // AI 决定是否使用卡片和交易股票
      if (player.personality === AIPersonality.GEMINI) {
        await this.handleGeminiPreTurnActions(player);
      } else {
        await this.handleAICardUse(player);
        await this.handleAIStockTrade(player);
      }
    }

    // Jail check
    if (player.inJail) {
      const jailCardIndex = player.cards.indexOf(CardType.GET_OUT_OF_JAIL);
      
      if (player.isHuman && !player.autoPlay) {
        // 人类玩家在监狱中的决策
        const options: DecisionOption[] = [];
        
        if (jailCardIndex >= 0) {
          options.push({ label: '使用免费出狱卡', action: 'useJailCard' });
        }
        
        if (player.money >= 50) {
          options.push({ label: '支付保释金 ($50)', action: 'payBail' });
        }
        
        options.push({ label: '尝试掷骰子越狱', action: 'rollEscape' });
        
        this.state.phase = GamePhase.PLAYER_DECISION;
        this.state.decisionOptions = options;
        this.emit('phaseChange', GamePhase.PLAYER_DECISION);
        const action = await this.waitForAction();
        
        if (action === 'useJailCard' && jailCardIndex >= 0) {
          player.cards.splice(jailCardIndex, 1);
          player.inJail = false;
          player.jailTurns = 0;
          this.addMessage(`${player.name} 使用免费出狱卡！`, '#9b59b6');
          this.emit('cardUsed', { playerIndex: player.index, cardType: CardType.GET_OUT_OF_JAIL });
        } else if (action === 'payBail' && player.money >= 50) {
          player.money -= 50;
          player.inJail = false;
          player.jailTurns = 0;
          this.addMessage(`${player.name} 支付保释金出狱！`, player.color);
        } else {
          // Roll for doubles to escape
          this.state.phase = GamePhase.ROLLING_DICE;
          const dice = rollDice();
          this.state.dice = dice;
          this.emit('diceRolled', dice);
          await this.delay(1000);

          if (dice.isDouble) {
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessage(`${player.name} 掷出双数，越狱成功！`, player.color);
            this.emit('jailEscape', { playerIndex: player.index });
            await this.movePlayer(player, dice.total);
            await this.handleLanding(player);
          } else {
            player.jailTurns++;
            if (player.jailTurns > 3) {
              player.inJail = false;
              player.jailTurns = 0;
              this.addMessage(`${player.name} 刑满释放！`, player.color);
            } else {
              this.addMessage(`${player.name} 在监狱中（第${player.jailTurns}回合）`, player.color);
            }
          }
        }
      } else {
        // AI玩家在监狱中的决策
        if (jailCardIndex >= 0 && (player.isHuman ? player.autoPlay : AI.shouldUseJailCard(player))) {
          player.cards.splice(jailCardIndex, 1);
          player.inJail = false;
          player.jailTurns = 0;
          this.addMessage(`${player.name} 使用免费出狱卡！`, '#9b59b6');
          this.emit('cardUsed', { playerIndex: player.index, cardType: CardType.GET_OUT_OF_JAIL });
        } else {
          player.jailTurns++;
          if (player.jailTurns > 3) {
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessage(`${player.name} 刑满释放！`, player.color);
          } else {
            // Roll for doubles to escape
            this.state.phase = GamePhase.ROLLING_DICE;
            const dice = rollDice();
            this.state.dice = dice;
            this.emit('diceRolled', dice);
            await this.delay(1000);

            if (dice.isDouble) {
              player.inJail = false;
              player.jailTurns = 0;
              this.addMessage(`${player.name} 掷出双数，越狱成功！`, player.color);
              this.emit('jailEscape', { playerIndex: player.index });
              await this.movePlayer(player, dice.total);
              await this.handleLanding(player);
            } else {
              this.addMessage(`${player.name} 在监狱中（第${player.jailTurns}回合）`, player.color);
            }
          }
        }
      }
      
      this.state.phase = GamePhase.TURN_END;
      this.emit('phaseChange', GamePhase.TURN_END);
      await this.delay(500);
      this.updateStockPrices();
      this.checkGameOver();
      if ((this.state.phase as GamePhase) !== GamePhase.GAME_OVER) this.nextPlayer();
      return;
    }

    // Normal turn: wait for roll
    const shouldAutoPlay = player.isHuman && player.autoPlay;
    let doubleCount = 0;
    
    while (true) {
      if (player.isHuman && !player.autoPlay) {
        this.state.phase = GamePhase.WAITING;
        this.emit('phaseChange', GamePhase.WAITING);
        await this.waitForAction('roll');
      } else {
        await this.delay(800 + Math.random() * 400);
      }

      // Roll dice
      this.state.phase = GamePhase.ROLLING_DICE;
      const dice = rollDice();
      this.state.dice = dice;
      this.emit('diceRolled', dice);
      this.addMessage(`${player.name} 掷出了 ${dice.die1}+${dice.die2}=${dice.total}`, player.color);
      await this.delay(1200);

      // Move
      await this.movePlayer(player, dice.total);
      await this.handleLanding(player);
      
      // 检查是否掷出双骰
      if (dice.isDouble) {
        doubleCount++;
        if (doubleCount >= 3) {
          // 连续3次双骰，进监狱
          player.position = 8;
          player.inJail = true;
          player.jailTurns = 0;
          this.addMessage(`${player.name} 连续3次掷出双骰，被送进监狱！`, '#e74c3c');
          this.emit('goToJail', { playerIndex: player.index });
          break;
        } else {
          // 询问是否再次掷骰子
          const options: DecisionOption[] = [
            { label: `再次掷骰子 (第${doubleCount + 1}次)`, action: 'rollAgain' },
            { label: '结束回合', action: 'endTurn' }
          ];
          
          if (player.isHuman && !player.autoPlay) {
            this.state.phase = GamePhase.PLAYER_DECISION;
            this.state.decisionOptions = options;
            this.emit('phaseChange', GamePhase.PLAYER_DECISION);
            const action = await this.waitForAction();
            
            if (action === 'endTurn') {
              break;
            }
          } else {
            if (player.personality === AIPersonality.GEMINI) {
              this.state.phase = GamePhase.AI_THINKING;
              await this.delay(600 + Math.random() * 400);
              const action = await this.getGeminiDecision(player, options);
              if (action === 'endTurn') {
                break;
              }
            } else {
              // 传统AI有50%概率再次掷骰子
              if (Math.random() > 0.5) {
                break;
              }
            }
          }
        }
      } else {
        break;
      }
    }

    // Turn end
    this.state.phase = GamePhase.TURN_END;
    this.emit('phaseChange', GamePhase.TURN_END);
    await this.delay(400);
    this.updateStockPrices();
    this.checkGameOver();
    if ((this.state.phase as GamePhase) !== GamePhase.GAME_OVER) this.nextPlayer();
  }

  private async movePlayer(player: PlayerState, steps: number): Promise<void> {
    this.state.phase = GamePhase.ANIMATING_MOVE;
    this.emit('phaseChange', GamePhase.ANIMATING_MOVE);

    for (let i = 0; i < steps; i++) {
      const oldPos = player.position;
      player.position = (player.position + 1) % TOTAL_TILES;
      // Passed GO
      if (player.position === 0 && oldPos !== 0) {
        player.money += GO_SALARY;
        this.addMessage(`${player.name} 经过起点，获得 $${GO_SALARY}`, '#2ecc71');
        this.emit('passedGo', { playerIndex: player.index });
      }
      this.emit('playerStep', { playerIndex: player.index, position: player.position, fromPos: oldPos });
      await this.delay(250);
    }
  }

  private async handleLanding(player: PlayerState): Promise<void> {
    const tile = TILE_DEFS[player.position];
    this.state.phase = GamePhase.LANDED_ACTION;

    switch (tile.type) {
      case TileType.GO:
        this.addMessage(`${player.name} 到达起点`, player.color);
        break;

      case TileType.PROPERTY:
        await this.handleProperty(player, player.position);
        break;

      case TileType.CHANCE:
        await this.handleChance(player);
        break;

      case TileType.TAX:
        player.money -= TAX_AMOUNT;
        this.addMessage(`${player.name} 缴纳税款 $${TAX_AMOUNT}`, '#e74c3c');
        this.checkBankrupt(player);
        break;

      case TileType.JAIL:
        this.addMessage(`${player.name} 探访监狱`, player.color);
        break;

      case TileType.FREE_PARKING:
        this.addMessage(`${player.name} 在免费停车休息`, player.color);
        break;

      case TileType.GO_TO_JAIL:
        player.position = 8; // jail tile
        player.inJail = true;
        player.jailTurns = 0;
        this.addMessage(`${player.name} 被送进监狱！`, '#e74c3c');
        this.emit('goToJail', { playerIndex: player.index });
        this.emit('playerStep', { playerIndex: player.index, position: 8, fromPos: 24 });
        break;
    }
  }

  private async handleProperty(player: PlayerState, tileIndex: number): Promise<void> {
    const tile = TILE_DEFS[tileIndex];
    const prop = this.state.properties[tileIndex];
    const shouldAutoPlay = player.isHuman && player.autoPlay;

    if (prop.ownerIndex === -1) {
      if (player.money >= tile.price) {
        if (player.isHuman && !player.autoPlay) {
          this.state.phase = GamePhase.PLAYER_DECISION;
          this.state.decisionOptions = [
            { label: `购买 ${tile.name} ($${tile.price})`, action: 'buy' },
            { label: '不购买', action: 'pass' },
          ];
          this.emit('phaseChange', GamePhase.PLAYER_DECISION);
          const action = await this.waitForAction();
          if (action === 'buy') {
            this.buyProperty(player, tileIndex);
          } else {
            this.addMessage(`${player.name} 放弃购买 ${tile.name}`, player.color);
          }
        } else {
          this.state.phase = GamePhase.AI_THINKING;
          await this.delay(800 + Math.random() * 400);
          
          let shouldBuy: boolean;
          if (player.personality === AIPersonality.GEMINI) {
            const action = await this.getGeminiDecision(player, [
              { label: `购买 ${tile.name} ($${tile.price})`, action: 'buy' },
              { label: '不购买', action: 'pass' },
            ]);
            shouldBuy = action === 'buy';
          } else {
            shouldBuy = AI.shouldBuy(player, tileIndex, this.state.properties);
          }
          
          if (shouldBuy) {
            this.buyProperty(player, tileIndex);
          } else {
            this.addMessage(`${player.name} 放弃购买 ${tile.name}`, player.color);
          }
        }
      } else {
        this.addMessage(`${player.name} 资金不足，无法购买 ${tile.name}`, player.color);
      }
    } else if (prop.ownerIndex !== player.index) {
      const owner = this.state.players[prop.ownerIndex];
      if (!owner.bankrupt && !owner.inJail) {
        if (player.immuneTurns > 0) {
          this.addMessage(`${player.name} 使用免租效果，免付租金！`, '#9b59b6');
        } else {
          const rent = tile.rent[prop.buildings];
          player.money -= rent;
          owner.money += rent;
          this.addMessage(`${player.name} 向 ${owner.name} 支付租金 $${rent}`, '#e74c3c');
          this.emit('rentPaid', { payerIndex: player.index, ownerIndex: owner.index, rent });
          this.checkBankrupt(player);
        }
      }
    } else {
      await this.handleBuild(player, tileIndex);
    }
  }

  private async handleBuild(player: PlayerState, tileIndex: number): Promise<void> {
    const tile = TILE_DEFS[tileIndex];
    const prop = this.state.properties[tileIndex];

    const groupTiles = TILE_DEFS.filter(t => t.colorGroup === tile.colorGroup);
    const ownsAll = groupTiles.every(t => this.state.properties[t.index].ownerIndex === player.index);
    if (!ownsAll) return;

    while (prop.buildings < 5 && player.money >= tile.buildCost) {
      if (player.isHuman && !player.autoPlay) {
        const buildingName = prop.buildings === 4 ? '酒店' : `${prop.buildings + 1}级`;
        this.state.phase = GamePhase.PLAYER_DECISION;
        this.state.decisionOptions = [
          { label: `升级到${buildingName} ($${tile.buildCost})`, action: 'build' },
          { label: '不升级', action: 'pass' },
        ];
        this.emit('phaseChange', GamePhase.PLAYER_DECISION);
        const action = await this.waitForAction();
        if (action === 'build') {
          this.buildOnProperty(player, tileIndex);
        } else {
          break;
        }
      } else {
        this.state.phase = GamePhase.AI_THINKING;
        await this.delay(600 + Math.random() * 400);
        
        let shouldBuild: boolean;
        if (player.personality === AIPersonality.GEMINI) {
          const buildingName = prop.buildings === 4 ? '酒店' : `${prop.buildings + 1}级`;
          const action = await this.getGeminiDecision(player, [
            { label: `升级到${buildingName} ($${tile.buildCost})`, action: 'build' },
            { label: '不升级', action: 'pass' },
          ]);
          shouldBuild = action === 'build';
        } else {
          shouldBuild = AI.shouldBuild(player, tileIndex, this.state.properties);
        }
        
        if (shouldBuild) {
          this.buildOnProperty(player, tileIndex);
        } else {
          break;
        }
      }
    }
  }

  private buyProperty(player: PlayerState, tileIndex: number) {
    const tile = TILE_DEFS[tileIndex];
    player.money -= tile.price;
    this.state.properties[tileIndex].ownerIndex = player.index;
    this.state.properties[tileIndex].buildings = 1; // Start with level 1 building
    this.addMessage(`${player.name} 购买了 ${tile.name} ($${tile.price})`, player.color);
    this.emit('propertyBought', { playerIndex: player.index, tileIndex });
  }

  private buildOnProperty(player: PlayerState, tileIndex: number) {
    const tile = TILE_DEFS[tileIndex];
    const prop = this.state.properties[tileIndex];
    player.money -= tile.buildCost;
    prop.buildings++;
    const label = prop.buildings === 5 ? '酒店' : `${prop.buildings}级建筑`;
    this.addMessage(`${player.name} 在 ${tile.name} 升级到${label} ($${tile.buildCost})`, player.color);
    this.emit('buildProperty', { playerIndex: player.index, tileIndex });
  }

  private async handleChance(player: PlayerState): Promise<void> {
    const events = [
      { text: '银行发放红利，获得 $100', money: 100 },
      { text: '医疗费用，支付 $100', money: -100 },
      { text: '中了小奖，获得 $50', money: 50 },
      { text: '房屋维修，支付 $80', money: -80 },
      { text: '生日快乐！获得 $150', money: 150 },
      { text: '交通罚款，支付 $50', money: -50 },
      { text: '投资回报，获得 $200', money: 200 },
      { text: '意外事故，支付 $120', money: -120 },
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    player.money += event.money;
    const color = event.money > 0 ? '#2ecc71' : '#e74c3c';
    this.addMessage(`${player.name}: ${event.text}`, color);
    this.emit('chanceCard', { playerIndex: player.index, money: event.money });
    this.checkBankrupt(player);

    // 有概率获得卡片
    if (Math.random() < CARD_CHANCE && player.cards.length < MAX_CARDS) {
      const cardDef = CARD_DEFS[Math.floor(Math.random() * CARD_DEFS.length)];
      player.cards.push(cardDef.type);
      this.addMessage(`${player.name} 获得了 ${cardDef.name}！`, '#9b59b6');
      this.emit('cardObtained', { playerIndex: player.index, cardType: cardDef.type });
    }
  }

  private checkBankrupt(player: PlayerState) {
    if (player.money < 0) {
      player.bankrupt = true;
      player.money = 0;
      // Release properties
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (this.state.properties[i].ownerIndex === player.index) {
          this.state.properties[i].ownerIndex = -1;
          this.state.properties[i].buildings = 0;
        }
      }
      this.addMessage(`${player.name} 破产了！`, '#e74c3c');
      this.emit('bankrupt', { playerIndex: player.index });
    }
  }

  private checkGameOver() {
    const active = this.activePlayers();
    if (active.length <= 1) {
      this.state.phase = GamePhase.GAME_OVER;
      this.state.winner = active.length === 1 ? active[0].index : -1;
      if (active.length === 1) {
        this.addMessage(`${active[0].name} 获得胜利！`, '#f1c40f');
      }
      this.emit('phaseChange', GamePhase.GAME_OVER);
    }
  }

  private nextPlayer() {
    const players = this.state.players;
    let next = (this.state.currentPlayerIndex + 1) % players.length;
    let safety = 0;
    while (players[next].bankrupt && safety < players.length) {
      next = (next + 1) % players.length;
      safety++;
    }
    this.state.currentPlayerIndex = next;
    this.state.turnCount++;
    this.emit('turnChange', next);
  }

  // Wait for human input
  private waitForAction(expectedAction?: string): Promise<string> {
    if (this.onWaitingForInput) this.onWaitingForInput();
    return new Promise(resolve => {
      this.resolveDecision = resolve;
    });
  }

  // Called by UI when player clicks a button
  handleAction(action: string) {
    if (this.resolveDecision) {
      const resolve = this.resolveDecision;
      this.resolveDecision = null;
      this.state.decisionOptions = [];
      resolve(action);
    }
  }

  private delay(ms: number): Promise<void> {
    if (this.onDelay) this.onDelay();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start the game loop
  async startGame(): Promise<void> {
    // Wait for character selection
    if (this.state.phase === GamePhase.CHARACTER_SELECT) {
      await new Promise<void>(resolve => {
        this.resolveCharacterSelect = resolve;
      });
    }
    while ((this.state.phase as GamePhase) !== GamePhase.GAME_OVER) {
      await this.executeTurn();
    }
  }

  // ===== Card System =====
  private async handlePreTurnActions(player: PlayerState): Promise<void> {
    const options: DecisionOption[] = [];
    
    // 检查可用的卡片
    if (player.cards.length > 0) {
      player.cards.forEach((cardType, index) => {
        // 免租卡
        if (cardType === CardType.IMMUNITY && player.immuneTurns === 0) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '免租卡'}`, action: `useCard_${index}` });
        }
        // 传送卡
        else if (cardType === CardType.TELEPORT) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '传送卡'}`, action: `useCard_${index}` });
        }
        // 攻击性卡片 - 需要选择目标
        else if ([CardType.ATTACK, CardType.STEAL_MONEY, CardType.FREEZE, CardType.ROB].includes(cardType)) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '卡片'}`, action: `useCard_${index}` });
        }
      });
    }
    
    // 股票交易选项
    if (this.state.stocks.length > 0 && player.money > 100) {
      options.push({ label: '查看股票市场', action: 'viewStocks' });
    }
    
    if (options.length > 0) {
      options.push({ label: '直接开始回合', action: 'skipPreTurn' });
      
      this.state.phase = GamePhase.PLAYER_DECISION;
      this.state.decisionOptions = options;
      this.emit('phaseChange', GamePhase.PLAYER_DECISION);
      const action = await this.waitForAction();
      
      if (action.startsWith('useCard_')) {
        const cardIndex = parseInt(action.split('_')[1]);
        const cardType = player.cards[cardIndex];
        
        if (cardType === CardType.IMMUNITY) {
          this.useCard(player.index, cardType);
        } else if (cardType === CardType.TELEPORT) {
          await this.handleTeleportCard(player, cardIndex);
        } else if ([CardType.ATTACK, CardType.STEAL_MONEY, CardType.FREEZE, CardType.ROB].includes(cardType)) {
          await this.handleAttackCard(player, cardIndex, cardType);
        }
      } else if (action === 'viewStocks') {
        await this.handleStockDecisions(player);
      }
    }
  }

  private async handleTeleportCard(player: PlayerState, cardIndex: number): Promise<void> {
    const options: DecisionOption[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = TILE_DEFS[i];
      options.push({ label: `传送到${tile.name}`, action: `teleport_${i}` });
    }
    options.push({ label: '取消', action: 'cancelTeleport' });
    
    this.state.phase = GamePhase.PLAYER_DECISION;
    this.state.decisionOptions = options;
    this.emit('phaseChange', GamePhase.PLAYER_DECISION);
    const action = await this.waitForAction();
    
    if (action.startsWith('teleport_')) {
      const targetPos = parseInt(action.split('_')[1]);
      player.cards.splice(cardIndex, 1);
      const oldPos = player.position;
      player.position = targetPos;
      this.addMessage(`${player.name} 使用传送卡，传送到 ${TILE_DEFS[targetPos].name}！`, '#9b59b6');
      this.emit('playerStep', { playerIndex: player.index, position: player.position, fromPos: oldPos });
    }
  }

  private async handleAttackCard(player: PlayerState, cardIndex: number, cardType: CardType): Promise<void> {
    const validTargets = this.state.players.filter(p => p.index !== player.index && !p.bankrupt);
    if (validTargets.length === 0) {
      this.addMessage('没有可攻击的目标！', '#e74c3c');
      return;
    }
    
    const options: DecisionOption[] = validTargets.map(p => ({
      label: `攻击 ${p.name}`, action: `attack_${p.index}`
    }));
    options.push({ label: '取消', action: 'cancelAttack' });
    
    this.state.phase = GamePhase.PLAYER_DECISION;
    this.state.decisionOptions = options;
    this.emit('phaseChange', GamePhase.PLAYER_DECISION);
    const action = await this.waitForAction();
    
    if (action.startsWith('attack_')) {
      const targetIndex = parseInt(action.split('_')[1]);
      const targetData = { targetPlayerIndex: targetIndex };
      this.useCard(player.index, cardType, targetData);
    }
  }

  private async handleStockDecisions(player: PlayerState): Promise<void> {
    for (const stock of this.state.stocks) {
      const holding = player.stocks[stock.id] || 0;
      
      if (player.money >= stock.price && holding < 10) {
        this.state.phase = GamePhase.PLAYER_DECISION;
        this.state.decisionOptions = [
          { label: `买入${stock.name} ($${stock.price})`, action: `buyStock_${stock.id}` },
          { label: '跳过', action: 'skipStock' },
        ];
        
        if (holding > 0) {
          this.state.decisionOptions.splice(1, 0, { label: `卖出${holding}股${stock.name}`, action: `sellStock_${stock.id}` });
        }
        
        this.emit('phaseChange', GamePhase.PLAYER_DECISION);
        const action = await this.waitForAction();
        
        if (action.startsWith('buyStock_')) {
          const stockId = action.split('_')[1];
          this.buyStock(player.index, stockId, 1);
        } else if (action.startsWith('sellStock_')) {
          const stockId = action.split('_')[1];
          const sellShares = Math.min(holding, 1);
          if (sellShares > 0) {
            this.sellStock(player.index, stockId, sellShares);
          }
        }
      }
    }
  }

  private async handleGeminiPreTurnActions(player: PlayerState): Promise<void> {
    const options: DecisionOption[] = [];
    
    if (player.cards.length > 0) {
      player.cards.forEach((cardType, index) => {
        if (cardType === CardType.IMMUNITY && player.immuneTurns === 0) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '免租卡'}`, action: `useCard_${index}` });
        }
        else if (cardType === CardType.TELEPORT) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '传送卡'}`, action: `useCard_${index}` });
        }
        else if ([CardType.ATTACK, CardType.STEAL_MONEY, CardType.FREEZE, CardType.ROB].includes(cardType)) {
          const cardDef = CARD_DEFS.find(c => c.type === cardType);
          options.push({ label: `使用${cardDef?.name || '卡片'}`, action: `useCard_${index}` });
        }
      });
    }
    
    if (this.state.stocks.length > 0 && player.money > 100) {
      options.push({ label: '查看股票市场', action: 'viewStocks' });
    }
    
    if (options.length > 0) {
      options.push({ label: '直接开始回合', action: 'skipPreTurn' });
      
      this.state.phase = GamePhase.AI_THINKING;
      await this.delay(600 + Math.random() * 400);
      const action = await this.getGeminiDecision(player, options);
      
      if (action.startsWith('useCard_')) {
        const cardIndex = parseInt(action.split('_')[1]);
        const cardType = player.cards[cardIndex];
        
        if (cardType === CardType.IMMUNITY) {
          this.useCard(player.index, cardType);
        } else if (cardType === CardType.TELEPORT) {
          await this.handleTeleportCard(player, cardIndex);
        } else if ([CardType.ATTACK, CardType.STEAL_MONEY, CardType.FREEZE, CardType.ROB].includes(cardType)) {
          await this.handleAttackCard(player, cardIndex, cardType);
        }
      } else if (action === 'viewStocks') {
        await this.handleGeminiStockDecisions(player);
      }
    }
  }

  private async handleGeminiStockDecisions(player: PlayerState): Promise<void> {
    for (const stock of this.state.stocks) {
      const holding = player.stocks[stock.id] || 0;
      
      if (player.money >= stock.price && holding < 10) {
        this.state.phase = GamePhase.AI_THINKING;
        const options: DecisionOption[] = [
          { label: `买入${stock.name} ($${stock.price})`, action: `buyStock_${stock.id}` },
          { label: '跳过', action: 'skipStock' },
        ];
        
        if (holding > 0) {
          options.splice(1, 0, { label: `卖出${holding}股${stock.name}`, action: `sellStock_${stock.id}` });
        }
        
        await this.delay(400 + Math.random() * 300);
        const action = await this.getGeminiDecision(player, options);
        
        if (action.startsWith('buyStock_')) {
          const stockId = action.split('_')[1];
          this.buyStock(player.index, stockId, 1);
        } else if (action.startsWith('sellStock_')) {
          const stockId = action.split('_')[1];
          const sellShares = Math.min(holding, 1);
          if (sellShares > 0) {
            this.sellStock(player.index, stockId, sellShares);
          }
        }
      }
    }
  }

  private async handleAICardUse(player: PlayerState): Promise<void> {
    // AI 决定是否使用免租卡
    if (player.cards.includes(CardType.IMMUNITY) && player.immuneTurns === 0) {
      if (AI.shouldUseImmunityCard(player, this.state)) {
        const cardIndex = player.cards.indexOf(CardType.IMMUNITY);
        player.cards.splice(cardIndex, 1);
        player.immuneTurns = 3;
        this.addMessage(`${player.name} 使用了免租卡！`, '#9b59b6');
        this.emit('cardUsed', { playerIndex: player.index, cardType: CardType.IMMUNITY });
      }
    }
  }

  private async handleAIStockTrade(player: PlayerState): Promise<void> {
    // AI 决定是否买卖股票
    for (const stock of this.state.stocks) {
      const holding = player.stocks[stock.id] || 0;

      // 决定是否买入
      if (AI.shouldBuyStock(player, stock, this.state)) {
        const maxShares = Math.floor(player.money * 0.2 / stock.price); // 最多用20%资金买
        if (maxShares > 0) {
          const shares = Math.min(maxShares, 5); // 每次最多买5股
          player.money -= shares * stock.price;
          player.stocks[stock.id] = holding + shares;
          this.addMessage(`${player.name} 买入 ${shares} 股 ${stock.name}`, '#3498db');
          this.emit('stockBought', { playerIndex: player.index, stockId: stock.id, shares, price: stock.price });
        }
      }

      // 决定是否卖出
      if (holding > 0 && AI.shouldSellStock(player, stock, holding, this.state)) {
        const sellShares = Math.ceil(holding / 2); // 卖出一半
        player.money += sellShares * stock.price;
        player.stocks[stock.id] = holding - sellShares;
        this.addMessage(`${player.name} 卖出 ${sellShares} 股 ${stock.name}`, '#e67e22');
        this.emit('stockSold', { playerIndex: player.index, stockId: stock.id, shares: sellShares, price: stock.price });
      }
    }
  }

  // 股票价格波动
  private updateStockPrices(): void {
    for (const stock of this.state.stocks) {
      // 基础波动 -10% 到 +10%
      let change = (Math.random() - 0.5) * 0.2;

      // 趋势影响
      change += stock.trend * 0.03;

      // 小概率大涨或大跌
      if (Math.random() < 0.05) {
        change = Math.random() < 0.5 ? -0.2 : 0.2; // 20%涨跌
        stock.trend = change > 0 ? 2 : -2;
      } else {
        // 趋势逐渐回归
        stock.trend = Math.max(-2, Math.min(2, stock.trend + (Math.random() - 0.5)));
      }

      const oldPrice = stock.price;
      stock.price = Math.max(20, Math.round(stock.price * (1 + change)));

      if (Math.abs(stock.price - oldPrice) > oldPrice * 0.1) {
        const direction = stock.price > oldPrice ? '上涨' : '下跌';
        const percent = Math.round(Math.abs(stock.price - oldPrice) / oldPrice * 100);
        this.emit('stockPriceChange', { stockId: stock.id, oldPrice, newPrice: stock.price, direction, percent });
      }
    }
  }

  // 人类玩家使用卡片
  useCard(playerIndex: number, cardType: CardType, targetData?: any): boolean {
    const player = this.state.players[playerIndex];
    if (!player || player.bankrupt) return false;

    const cardIndex = player.cards.indexOf(cardType);
    if (cardIndex === -1) return false;

    switch (cardType) {
      case CardType.IMMUNITY:
        if (player.immuneTurns > 0) return false;
        player.cards.splice(cardIndex, 1);
        player.immuneTurns = 3;
        this.addMessage(`${player.name} 使用了免租卡！`, '#9b59b6');
        this.emit('cardUsed', { playerIndex, cardType });
        return true;

      case CardType.GET_OUT_OF_JAIL:
        if (!player.inJail) return false;
        player.cards.splice(cardIndex, 1);
        player.inJail = false;
        player.jailTurns = 0;
        this.addMessage(`${player.name} 使用免费出狱卡！`, '#9b59b6');
        this.emit('cardUsed', { playerIndex, cardType });
        return true;

      case CardType.TELEPORT:
        if (targetData?.position === undefined) return false;
        player.cards.splice(cardIndex, 1);
        const oldPos = player.position;
        player.position = targetData.position % TOTAL_TILES;
        this.addMessage(`${player.name} 使用传送卡！`, '#9b59b6');
        this.emit('cardUsed', { playerIndex, cardType });
        this.emit('playerStep', { playerIndex, position: player.position, fromPos: oldPos });
        return true;

      case CardType.ROB:
        if (targetData?.targetPlayerIndex === undefined) return false;
        const target = this.state.players[targetData.targetPlayerIndex];
        if (!target || target.bankrupt || target.cards.length === 0) return false;
        player.cards.splice(cardIndex, 1);
        const stolenCard = target.cards[Math.floor(Math.random() * target.cards.length)];
        target.cards.splice(target.cards.indexOf(stolenCard), 1);
        player.cards.push(stolenCard);
        const cardName = CARD_DEFS.find(c => c.type === stolenCard)?.name || '卡片';
        this.addMessage(`${player.name} 从 ${target.name} 抢夺了 ${cardName}！`, '#9b59b6');
        this.emit('cardUsed', { playerIndex, cardType, targetPlayerIndex: targetData.targetPlayerIndex });
        return true;

      case CardType.ATTACK:
        if (targetData?.targetPlayerIndex === undefined) return false;
        const attackTarget = this.state.players[targetData.targetPlayerIndex];
        if (!attackTarget || attackTarget.bankrupt) return false;
        player.cards.splice(cardIndex, 1);
        const newPos = (attackTarget.position - 3 + TOTAL_TILES) % TOTAL_TILES;
        attackTarget.position = newPos;
        this.addMessage(`${player.name} 对 ${attackTarget.name} 使用了攻击卡！${attackTarget.name}后退3格！`, '#e74c3c');
        this.emit('cardUsed', { playerIndex, cardType, targetPlayerIndex: targetData.targetPlayerIndex });
        return true;

      case CardType.STEAL_MONEY:
        if (targetData?.targetPlayerIndex === undefined) return false;
        const stealTarget = this.state.players[targetData.targetPlayerIndex];
        if (!stealTarget || stealTarget.bankrupt || stealTarget.money < 100) return false;
        player.cards.splice(cardIndex, 1);
        stealTarget.money -= 100;
        player.money += 100;
        this.addMessage(`${player.name} 对 ${stealTarget.name} 使用了盗窃卡！抢走了$100！`, '#e74c3c');
        this.emit('cardUsed', { playerIndex, cardType, targetPlayerIndex: targetData.targetPlayerIndex });
        return true;

      case CardType.FREEZE:
        if (targetData?.targetPlayerIndex === undefined) return false;
        const freezeTarget = this.state.players[targetData.targetPlayerIndex];
        if (!freezeTarget || freezeTarget.bankrupt) return false;
        player.cards.splice(cardIndex, 1);
        freezeTarget.frozenTurns = 1;
        this.addMessage(`${player.name} 对 ${freezeTarget.name} 使用了冰冻卡！${freezeTarget.name}下一回合无法行动！`, '#3498db');
        this.emit('cardUsed', { playerIndex, cardType, targetPlayerIndex: targetData.targetPlayerIndex });
        return true;

      default:
        return false;
    }
  }

  // 股票交易
  buyStock(playerIndex: number, stockId: string, shares: number): boolean {
    const player = this.state.players[playerIndex];
    if (!player || player.bankrupt || shares <= 0) return false;

    const stock = this.state.stocks.find(s => s.id === stockId);
    if (!stock) return false;

    const cost = shares * stock.price;
    if (player.money < cost) return false;

    player.money -= cost;
    player.stocks[stockId] = (player.stocks[stockId] || 0) + shares;
    this.addMessage(`${player.name} 买入 ${shares} 股 ${stock.name}`, '#3498db');
    this.emit('stockBought', { playerIndex, stockId, shares, price: stock.price });
    return true;
  }

  sellStock(playerIndex: number, stockId: string, shares: number): boolean {
    const player = this.state.players[playerIndex];
    if (!player || player.bankrupt || shares <= 0) return false;

    const stock = this.state.stocks.find(s => s.id === stockId);
    if (!stock) return false;

    const holding = player.stocks[stockId] || 0;
    if (holding < shares) return false;

    player.money += shares * stock.price;
    player.stocks[stockId] = holding - shares;
    this.addMessage(`${player.name} 卖出 ${shares} 股 ${stock.name}`, '#e67e22');
    this.emit('stockSold', { playerIndex, stockId, shares, price: stock.price });
    return true;
  }
}
