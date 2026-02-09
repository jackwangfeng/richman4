import { GameState, GamePhase } from '../types';
import { TILE_DEFS } from '../constants';

export class ClientStateHolder {
  state: GameState;

  constructor() {
    this.state = {
      phase: GamePhase.CHARACTER_SELECT,
      currentPlayerIndex: 0,
      players: [],
      properties: TILE_DEFS.map(() => ({ ownerIndex: -1, buildings: 0 })),
      dice: null,
      messages: [],
      decisionOptions: [],
      winner: -1,
      turnCount: 0,
    };
  }
}
