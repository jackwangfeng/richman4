import { PlayerState, PropertyState, AIPersonality, TileType } from '../types';
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
}
