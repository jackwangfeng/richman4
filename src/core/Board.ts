import { Vec3, Vec2 } from '../types';
import { TOTAL_TILES, TILE_DEFS, CAMERA_POS, CAMERA_PITCH, FOV, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

const BOARD_HALF = 1.0;
const TILE_DEPTH = 0.28;
const INNER_EDGE = BOARD_HALF - TILE_DEPTH;
const CORNER_SIZE = TILE_DEPTH; // corners are square

export class Board {
  tiles = TILE_DEFS;

  // Precompute: for each side, the start offset and tile width
  // Each side has 8 tiles: 1 corner + 7 regular
  // Corner at start of side takes CORNER_SIZE width
  // Remaining 7 tiles share the rest
  private regularWidth: number;

  constructor() {
    this.regularWidth = (2 * BOARD_HALF - 2 * CORNER_SIZE) / 7;
  }

  // Get the X or Z offset along a side for tile position within that side
  private getTileEdgeRange(posInSide: number): [number, number] {
    if (posInSide === 0) {
      // Corner tile
      return [-BOARD_HALF, -BOARD_HALF + CORNER_SIZE];
    }
    // Regular tiles 1-7
    const start = -BOARD_HALF + CORNER_SIZE + (posInSide - 1) * this.regularWidth;
    return [start, start + this.regularWidth];
  }

  // Returns the 3D world position (center) of a tile
  getTileWorldPos(index: number): Vec3 {
    const side = Math.floor(index / 8);
    const pos = index % 8;
    const [e0, e1] = this.getTileEdgeRange(pos);
    const mid = (e0 + e1) / 2;
    const depthMid = BOARD_HALF - TILE_DEPTH / 2;

    switch (side) {
      case 0: // bottom: left to right, z = +BOARD_HALF
        return { x: mid, y: 0, z: depthMid };
      case 1: // right: bottom to top, x = +BOARD_HALF
        return { x: depthMid, y: 0, z: -mid };
      case 2: // top: right to left, z = -BOARD_HALF
        return { x: -mid, y: 0, z: -depthMid };
      case 3: // left: top to bottom, x = -BOARD_HALF
        return { x: -depthMid, y: 0, z: mid };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }
  // Returns the 4 corners of a tile in 3D (consistent CCW winding viewed from above)
  getTileCorners(index: number): Vec3[] {
    const side = Math.floor(index / 8);
    const pos = index % 8;
    const [e0, e1] = this.getTileEdgeRange(pos);
    const outer = BOARD_HALF;
    const inner = INNER_EDGE;

    // For corners (pos===0), the tile is square: CORNER_SIZE x CORNER_SIZE
    // extending inward on both axes
    switch (side) {
      case 0: { // bottom edge, z positive
        return [
          { x: e0, y: 0, z: outer },
          { x: e1, y: 0, z: outer },
          { x: e1, y: 0, z: inner },
          { x: e0, y: 0, z: inner },
        ];
      }
      case 1: { // right edge, x positive
        // Along right side, "e" maps to z going from +BOARD_HALF downward to -BOARD_HALF
        return [
          { x: outer, y: 0, z: -e0 },
          { x: outer, y: 0, z: -e1 },
          { x: inner, y: 0, z: -e1 },
          { x: inner, y: 0, z: -e0 },
        ];
      }
      case 2: { // top edge, z negative
        return [
          { x: -e0, y: 0, z: -outer },
          { x: -e1, y: 0, z: -outer },
          { x: -e1, y: 0, z: -inner },
          { x: -e0, y: 0, z: -inner },
        ];
      }
      case 3: { // left edge, x negative
        return [
          { x: -outer, y: 0, z: e0 },
          { x: -outer, y: 0, z: e1 },
          { x: -inner, y: 0, z: e1 },
          { x: -inner, y: 0, z: e0 },
        ];
      }
      default:
        return [];
    }
  }

  // Project a 3D world point to 2D screen coordinates
  project(p: Vec3): Vec2 {
    // Translate relative to camera
    const dx = p.x - CAMERA_POS.x;
    const dy = p.y - CAMERA_POS.y;
    const dz = p.z - CAMERA_POS.z;

    // Rotate around X axis by CAMERA_PITCH to align view direction with -Z
    const cosPitch = Math.cos(CAMERA_PITCH);
    const sinPitch = Math.sin(CAMERA_PITCH);
    const rx = dx;
    const ry = dy * cosPitch - dz * sinPitch;
    const rz = dy * sinPitch + dz * cosPitch;

    // rz should be negative (in front of camera)
    if (rz >= -0.01) return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const scale = FOV / (-rz);
    const sx = CANVAS_WIDTH / 2 + rx * scale * CANVAS_WIDTH * 0.5;
    const sy = CANVAS_HEIGHT / 2 - ry * scale * CANVAS_HEIGHT * 0.5;

    return { x: sx, y: sy };
  }

  // Get the 2D screen polygon for a tile
  getTileScreenPoly(index: number): Vec2[] {
    return this.getTileCorners(index).map(c => this.project(c));
  }

  // Check if a screen point is inside a tile polygon
  isPointInTile(px: number, py: number, index: number): boolean {
    const poly = this.getTileScreenPoly(index);
    return this.pointInPolygon(px, py, poly);
  }

  private pointInPolygon(px: number, py: number, poly: Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
}
