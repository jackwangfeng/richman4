// ===== Enums =====

export enum GamePhase {
  CHARACTER_SELECT = 'CHARACTER_SELECT',
  WAITING = 'WAITING',
  ROLLING_DICE = 'ROLLING_DICE',
  ANIMATING_MOVE = 'ANIMATING_MOVE',
  LANDED_ACTION = 'LANDED_ACTION',
  PLAYER_DECISION = 'PLAYER_DECISION',
  AI_THINKING = 'AI_THINKING',
  TURN_END = 'TURN_END',
  GAME_OVER = 'GAME_OVER',
}

export enum TileType {
  GO = 'GO',
  PROPERTY = 'PROPERTY',
  CHANCE = 'CHANCE',
  TAX = 'TAX',
  JAIL = 'JAIL',
  FREE_PARKING = 'FREE_PARKING',
  GO_TO_JAIL = 'GO_TO_JAIL',
}

export enum AIPersonality {
  AGGRESSIVE = 'AGGRESSIVE',
  CONSERVATIVE = 'CONSERVATIVE',
  BALANCED = 'BALANCED',
}

export enum CardType {
  GET_OUT_OF_JAIL = 'GET_OUT_OF_JAIL',  // 免费出狱卡
  TELEPORT = 'TELEPORT',                 // 传送卡
  IMMUNITY = 'IMMUNITY',                 // 免租卡 (3回合)
  REMOTE_DICE = 'REMOTE_DICE',           // 遥控骰子
  ROB = 'ROB',                           // 抢夺卡
}

export interface CardDef {
  type: CardType;
  name: string;
  description: string;
}

// ===== Interfaces =====

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileDef {
  index: number;
  type: TileType;
  name: string;
  price: number;
  rent: number[];       // rent per building level [0..5]
  buildCost: number;
  colorGroup: number;   // -1 if not property
}

export interface PropertyState {
  ownerIndex: number;   // -1 = unowned
  buildings: number;    // 0-5 (5 = hotel)
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  walkFrames: string[];
  color: string;
  voice: string;
}

export interface PlayerState {
  index: number;
  name: string;
  color: string;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  isHuman: boolean;
  autoPlay: boolean;  // Human player delegates to AI
  personality: AIPersonality | null;
  characterId: string;
  cards: CardType[];      // 持有的卡片
  immuneTurns: number;    // 免租剩余回合
  stocks: Record<string, number>;  // 股票ID -> 持有数量
}

export interface Stock {
  id: string;
  name: string;
  price: number;
  trend: number;  // -2 到 +2
}

export interface DiceResult {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
}

export interface Animation {
  id: number;
  type: 'move' | 'dice' | 'fade' | 'bounce';
  startTime: number;
  duration: number;
  from: any;
  to: any;
  current: any;
  onUpdate?: (progress: number, anim: Animation) => void;
  resolve?: () => void;
}

export interface GameMessage {
  text: string;
  timestamp: number;
  color?: string;
}

export interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: string;
  visible: boolean;
  enabled: boolean;
}

export interface DecisionOption {
  label: string;
  action: string;
}

export interface GameState {
  phase: GamePhase;
  currentPlayerIndex: number;
  players: PlayerState[];
  properties: PropertyState[];
  dice: DiceResult | null;
  messages: GameMessage[];
  decisionOptions: DecisionOption[];
  winner: number;
  turnCount: number;
  stocks: Stock[];  // 当前股票列表
}
