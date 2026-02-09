import { PlayerState, PropertyState, AIPersonality, TileType, GameState, Stock, CardType } from '../types';
import { TILE_DEFS, TOTAL_TILES } from '../constants';

export class AI {
  // Decide whether to buy a property
  static shouldBuy(player: PlayerState, tileIndex: number, properties: PropertyState[]): boolean {
    const tile = TILE_DEFS[tileIndex];
    if (tile.type !== TileType.PROPERTY) return false;
    if (tile.price > player.money) return false;

    const moneyRatio = player.money / tile.price;

    // Count how many in same group we own
    const groupTiles = TILE_DEFS.filter(t => t.colorGroup === tile.colorGroup);
    const ownedInGroup = groupTiles.filter(t => properties[t.index].ownerIndex === player.index).length;

    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        // Buy if we can afford it (keep at least 100)
        return player.money - tile.price >= 100;
      case AIPersonality.CONSERVATIVE:
        // Only buy if we have 3x the price, or already own one in group
        return moneyRatio >= 3 || ownedInGroup > 0;
      case AIPersonality.BALANCED:
      default:
        // Buy if we have 1.5x the price, or own one in group
        return moneyRatio >= 1.5 || ownedInGroup > 0;
    }
  }

  // Decide whether to build on a property
  static shouldBuild(player: PlayerState, tileIndex: number, properties: PropertyState[]): boolean {
    const tile = TILE_DEFS[tileIndex];
    if (tile.type !== TileType.PROPERTY) return false;
    const prop = properties[tileIndex];
    if (prop.ownerIndex !== player.index) return false;
    if (prop.buildings >= 5) return false;
    if (tile.buildCost > player.money) return false;

    // Check if we own all in group
    const groupTiles = TILE_DEFS.filter(t => t.colorGroup === tile.colorGroup);
    const ownsAll = groupTiles.every(t => properties[t.index].ownerIndex === player.index);
    if (!ownsAll) return false;

    const moneyRatio = player.money / tile.buildCost;

    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        return moneyRatio >= 2;
      case AIPersonality.CONSERVATIVE:
        return moneyRatio >= 4;
      case AIPersonality.BALANCED:
      default:
        return moneyRatio >= 3;
    }
  }

  // Pick which property to build on (returns tile index or -1)
  static pickBuildTarget(player: PlayerState, properties: PropertyState[]): number {
    const candidates: number[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (this.shouldBuild(player, i, properties)) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return -1;
    // Pick the one with lowest buildings (even out)
    candidates.sort((a, b) => properties[a].buildings - properties[b].buildings);
    return candidates[0];
  }

  // ===== Card System AI =====

  // Decide whether to use jail card
  static shouldUseJailCard(player: PlayerState): boolean {
    // Always use jail card if we have one
    return true;
  }

  // Decide whether to use immunity card
  static shouldUseImmunityCard(player: PlayerState, state: GameState): boolean {
    // Count how many expensive properties are owned by others
    let dangerousProperties = 0;
    for (let i = 0; i < TOTAL_TILES; i++) {
      const prop = state.properties[i];
      const tile = TILE_DEFS[i];
      if (prop.ownerIndex >= 0 && prop.ownerIndex !== player.index && tile.rent[prop.buildings] > 100) {
        dangerousProperties++;
      }
    }

    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        // Use when there are many dangerous properties
        return dangerousProperties >= 5;
      case AIPersonality.CONSERVATIVE:
        // Use more readily
        return dangerousProperties >= 3;
      case AIPersonality.BALANCED:
      default:
        return dangerousProperties >= 4;
    }
  }

  // ===== Stock System AI =====

  // Decide whether to buy stock
  static shouldBuyStock(player: PlayerState, stock: Stock, state: GameState): boolean {
    // Don't buy if low on money
    if (player.money < 500) return false;

    const holding = player.stocks[stock.id] || 0;
    // Don't over-invest in one stock
    if (holding >= 10) return false;

    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        // Buy on positive trend or low price
        return stock.trend > 0 || stock.price < 100;
      case AIPersonality.CONSERVATIVE:
        // Only buy on strong positive trend and have lots of money
        return stock.trend >= 1 && player.money > 1500;
      case AIPersonality.BALANCED:
      default:
        // Buy on positive trend or neutral with good price
        return stock.trend > 0 || (stock.trend === 0 && stock.price < 120);
    }
  }

  // Decide whether to sell stock
  static shouldSellStock(player: PlayerState, stock: Stock, holding: number, state: GameState): boolean {
    if (holding <= 0) return false;

    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        // Sell only on strong negative trend
        return stock.trend <= -2;
      case AIPersonality.CONSERVATIVE:
        // Sell on any negative trend or if made profit
        return stock.trend < 0 || stock.price > 200;
      case AIPersonality.BALANCED:
      default:
        // Sell on negative trend
        return stock.trend <= -1;
    }
  }
}
