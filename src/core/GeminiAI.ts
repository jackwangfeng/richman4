import { PlayerState, PropertyState, GameState, DecisionOption } from '../types';
import { TILE_DEFS, TOTAL_TILES } from '../constants';
import { GeminiConfig, GeminiAIDecision, GeminiGameContext } from '../types';

export class GeminiAI {
  private config: GeminiConfig;
  private apiUrl: string;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    console.log('[GeminiAI] Calling Gemini API...', this.apiUrl);
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Failed to call Gemini API:', error);
      throw error;
    }
  }

  private buildContextPrompt(context: GeminiGameContext): string {
    const { player, gameState, decisionContext } = context;
    const tile = decisionContext.tileIndex !== undefined ? TILE_DEFS[decisionContext.tileIndex] : null;
    
    let prompt = `你是一个大富翁游戏的AI玩家。现在轮到你做决策了。

游戏上下文：
- 玩家名称: ${player.name}
- 当前金钱: $${player.money}
- 当前位置: ${player.position}
- 是否在监狱: ${player.inJail ? '是' : '否'}
- 当前回合: ${gameState.turnCount}
- 持有卡片: ${player.cards.length > 0 ? player.cards.join(', ') : '无'}
- 持有股票: ${JSON.stringify(player.stocks)}
- 免租剩余回合: ${player.immuneTurns}

其他玩家状态：
`;

    gameState.players.forEach(p => {
      if (p.index !== player.index && !p.bankrupt) {
        prompt += `- ${p.name}: $${p.money}, 位置: ${p.position}\n`;
      }
    });

    prompt += `\n当前地产状态：`;
    const ownedProperties = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      const prop = gameState.properties[i];
      const tileDef = TILE_DEFS[i];
      if (tileDef.type === 'PROPERTY') {
        if (prop.ownerIndex === player.index) {
          ownedProperties.push(`${tileDef.name} (${prop.buildings}级建筑)`);
        } else if (prop.ownerIndex >= 0) {
          const owner = gameState.players[prop.ownerIndex];
          prompt += `\n- ${tileDef.name}: 属于 ${owner?.name || '未知'}, ${prop.buildings}级建筑`;
        }
      }
    }

    if (ownedProperties.length > 0) {
      prompt += `\n\n你拥有的地产：`;
      ownedProperties.forEach(p => prompt += `\n- ${p}`);
    }

    prompt += `\n\n当前决策场景：`;
    switch (decisionContext.type) {
      case 'buy':
        if (tile) {
          prompt += `\n- 类型: 购买地产`;
          prompt += `\n- 地产名称: ${tile.name}`;
          prompt += `\n- 价格: $${tile.price}`;
          prompt += `\n- 建筑成本: $${tile.buildCost}`;
          prompt += `\n- 租金（按建筑等级）: ${tile.rent.join(', ')}`;
        }
        break;
      case 'build':
        if (tile) {
          const prop = gameState.properties[decisionContext.tileIndex!];
          prompt += `\n- 类型: 升级建筑`;
          prompt += `\n- 地产名称: ${tile.name}`;
          prompt += `\n- 当前建筑等级: ${prop.buildings}`;
          prompt += `\n- 升级成本: $${tile.buildCost}`;
        }
        break;
    }

    if (decisionContext.options && decisionContext.options.length > 0) {
      prompt += `\n\n可用选项：`;
      decisionContext.options.forEach((opt, idx) => {
        prompt += `\n${idx + 1}. ${opt.label} (action: ${opt.action})`;
      });
    }

    prompt += `\n\n请根据以上信息，做出最佳决策。返回JSON格式，包含以下字段：
- action: 选择的action值（必须是可用选项中的一个）
- reasoning: 简短的决策理由（中文）
- confidence: 决策的置信度（0-1之间的数字）

只返回JSON，不要有其他文字。`;

    return prompt;
  }

  async makeDecision(context: GeminiGameContext): Promise<GeminiAIDecision> {
    try {
      const prompt = this.buildContextPrompt(context);
      const response = await this.callGeminiAPI(prompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }
      
      const decision = JSON.parse(jsonMatch[0]) as GeminiAIDecision;
      
      if (!decision.action || !decision.reasoning || typeof decision.confidence !== 'number') {
        throw new Error('Missing required fields in decision');
      }
      
      return decision;
    } catch (error) {
      console.error('Failed to get Gemini AI decision:', error);
      
      const fallbackAction = context.decisionContext.options?.[0]?.action || 'pass';
      return {
        action: fallbackAction,
        reasoning: 'Gemini API调用失败，使用默认决策',
        confidence: 0.5
      };
    }
  }

  static shouldBuyWithGemini(player: PlayerState, tileIndex: number, properties: PropertyState[], config: GeminiConfig): Promise<boolean> {
    const ai = new GeminiAI(config);
    const gameState = {
      phase: 'PLAYER_DECISION' as any,
      currentPlayerIndex: player.index,
      players: [player],
      properties,
      dice: null,
      messages: [],
      decisionOptions: [],
      winner: -1,
      turnCount: 0,
      stocks: []
    };
    
    const context: GeminiGameContext = {
      player,
      gameState,
      decisionContext: {
        type: 'buy',
        tileIndex,
        options: [
          { label: '购买', action: 'buy' },
          { label: '不购买', action: 'pass' }
        ]
      }
    };
    
    return ai.makeDecision(context).then(decision => decision.action === 'buy');
  }

  static shouldBuildWithGemini(player: PlayerState, tileIndex: number, properties: PropertyState[], config: GeminiConfig): Promise<boolean> {
    const ai = new GeminiAI(config);
    const gameState = {
      phase: 'PLAYER_DECISION' as any,
      currentPlayerIndex: player.index,
      players: [player],
      properties,
      dice: null,
      messages: [],
      decisionOptions: [],
      winner: -1,
      turnCount: 0,
      stocks: []
    };
    
    const context: GeminiGameContext = {
      player,
      gameState,
      decisionContext: {
        type: 'build',
        tileIndex,
        options: [
          { label: '升级', action: 'build' },
          { label: '不升级', action: 'pass' }
        ]
      }
    };
    
    return ai.makeDecision(context).then(decision => decision.action === 'build');
  }
}
