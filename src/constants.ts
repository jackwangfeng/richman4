import { TileDef, TileType, Vec3, CharacterDef } from './types';

// ===== Board Layout =====
export const TOTAL_TILES = 32;
export const TILES_PER_SIDE = 8; // including corners

// ===== Money =====
export const STARTING_MONEY = 2000;
export const GO_SALARY = 200;
export const TAX_AMOUNT = 150;

// ===== Camera =====
export const CAMERA_POS: Vec3 = { x: 0, y: 2.2, z: 2.0 };
export const CAMERA_PITCH = Math.atan2(2.2, 2.0); // ~0.833 rad, correct look-at angle
export const FOV = 1.8;

// ===== Canvas =====
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

// ===== Characters =====
export const CHARACTER_DEFS: CharacterDef[] = [
  {
    id: 'sunxiaomei',  name: '孙小美',   description: '活泼可爱的年轻女孩',
    imagePath: '/characters/sunxiaomei.png',  color: '#e74c3c',
    walkFrames: ['/characters/sunxiaomei_walk_0.png', '/characters/sunxiaomei_walk_1.png', '/characters/sunxiaomei_walk_2.png', '/characters/sunxiaomei_walk_3.png'],
    voice: 'zh-CN-XiaoyiNeural',
  },
  {
    id: 'atube',       name: '阿土伯',   description: '朴实善良的老农民',
    imagePath: '/characters/atube.png',       color: '#f39c12',
    walkFrames: ['/characters/atube_walk_0.png', '/characters/atube_walk_1.png', '/characters/atube_walk_2.png', '/characters/atube_walk_3.png'],
    voice: 'zh-CN-YunxiaNeural',
  },
  {
    id: 'qianfuren',   name: '钱夫人',   description: '优雅富贵的贵妇人',
    imagePath: '/characters/qianfuren.png',   color: '#2ecc71',
    walkFrames: ['/characters/qianfuren_walk_0.png', '/characters/qianfuren_walk_1.png', '/characters/qianfuren_walk_2.png', '/characters/qianfuren_walk_3.png'],
    voice: 'zh-CN-XiaoxiaoNeural',
  },
  {
    id: 'shahongbasi', name: '沙隆巴斯', description: '精明能干的阿拉伯商人',
    imagePath: '/characters/shahongbasi.png', color: '#3498db',
    walkFrames: ['/characters/shahongbasi_walk_0.png', '/characters/shahongbasi_walk_1.png', '/characters/shahongbasi_walk_2.png', '/characters/shahongbasi_walk_3.png'],
    voice: 'zh-CN-YunjianNeural',
  },
];

// ===== Player Colors =====
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
export const PLAYER_NAMES = ['玩家', '曹操', '孙权', '刘备'];

// ===== Color Groups =====
export const GROUP_COLORS: Record<number, string> = {
  0: '#8B4513', // brown
  1: '#87CEEB', // light blue
  2: '#FF69B4', // pink
  3: '#FFA500', // orange
  4: '#FF0000', // red
  5: '#FFFF00', // yellow
  6: '#00AA00', // green
  7: '#0000CC', // dark blue
};

// ===== Tile Definitions (32 tiles) =====
// rent array: [no house, 1 house, 2 houses, 3 houses, 4 houses, hotel]
export const TILE_DEFS: TileDef[] = [
  // Bottom row (0-7): GO + 7 tiles
  { index: 0,  type: TileType.GO,          name: '起点',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 1,  type: TileType.PROPERTY,    name: '台北',     price: 60,  rent: [4,20,60,180,320,450],    buildCost: 50,  colorGroup: 0 },
  { index: 2,  type: TileType.CHANCE,      name: '机会',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 3,  type: TileType.PROPERTY,    name: '高雄',     price: 60,  rent: [4,20,60,180,320,450],    buildCost: 50,  colorGroup: 0 },
  { index: 4,  type: TileType.TAX,         name: '所得税',   price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 5,  type: TileType.PROPERTY,    name: '广州',     price: 100, rent: [6,30,90,270,400,550],    buildCost: 50,  colorGroup: 1 },
  { index: 6,  type: TileType.PROPERTY,    name: '深圳',     price: 100, rent: [6,30,90,270,400,550],    buildCost: 50,  colorGroup: 1 },
  { index: 7,  type: TileType.PROPERTY,    name: '珠海',     price: 120, rent: [8,40,100,300,450,600],   buildCost: 50,  colorGroup: 1 },
  // Right column (8-15): Jail corner + 7 tiles
  { index: 8,  type: TileType.JAIL,        name: '监狱',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 9,  type: TileType.PROPERTY,    name: '成都',     price: 140, rent: [10,50,150,450,625,750],  buildCost: 100, colorGroup: 2 },
  { index: 10, type: TileType.PROPERTY,    name: '重庆',     price: 140, rent: [10,50,150,450,625,750],  buildCost: 100, colorGroup: 2 },
  { index: 11, type: TileType.CHANCE,      name: '机会',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 12, type: TileType.PROPERTY,    name: '武汉',     price: 160, rent: [12,60,180,500,700,900],  buildCost: 100, colorGroup: 2 },
  { index: 13, type: TileType.PROPERTY,    name: '长沙',     price: 180, rent: [14,70,200,550,750,950],  buildCost: 100, colorGroup: 3 },
  { index: 14, type: TileType.PROPERTY,    name: '南京',     price: 180, rent: [14,70,200,550,750,950],  buildCost: 100, colorGroup: 3 },
  { index: 15, type: TileType.PROPERTY,    name: '杭州',     price: 200, rent: [16,80,220,600,800,1000], buildCost: 100, colorGroup: 3 },

  // Top row (16-23): Free Parking corner + 7 tiles
  { index: 16, type: TileType.FREE_PARKING, name: '免费停车', price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 17, type: TileType.PROPERTY,    name: '苏州',     price: 220, rent: [18,90,250,700,875,1050], buildCost: 150, colorGroup: 4 },
  { index: 18, type: TileType.PROPERTY,    name: '无锡',     price: 220, rent: [18,90,250,700,875,1050], buildCost: 150, colorGroup: 4 },
  { index: 19, type: TileType.CHANCE,      name: '机会',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 20, type: TileType.PROPERTY,    name: '天津',     price: 240, rent: [20,100,300,750,925,1100],buildCost: 150, colorGroup: 4 },
  { index: 21, type: TileType.PROPERTY,    name: '青岛',     price: 260, rent: [22,110,330,800,975,1150],buildCost: 150, colorGroup: 5 },
  { index: 22, type: TileType.TAX,         name: '奢侈税',   price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 23, type: TileType.PROPERTY,    name: '大连',     price: 260, rent: [22,110,330,800,975,1150],buildCost: 150, colorGroup: 5 },

  // Left column (24-31): Go-to-Jail corner + 7 tiles
  { index: 24, type: TileType.GO_TO_JAIL,  name: '入狱',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 25, type: TileType.PROPERTY,    name: '西安',     price: 280, rent: [24,120,360,850,1025,1200],buildCost: 200, colorGroup: 5 },
  { index: 26, type: TileType.PROPERTY,    name: '厦门',     price: 300, rent: [26,130,390,900,1100,1275],buildCost: 200, colorGroup: 6 },
  { index: 27, type: TileType.PROPERTY,    name: '福州',     price: 300, rent: [26,130,390,900,1100,1275],buildCost: 200, colorGroup: 6 },
  { index: 28, type: TileType.CHANCE,      name: '机会',     price: 0,   rent: [0,0,0,0,0,0],           buildCost: 0,   colorGroup: -1 },
  { index: 29, type: TileType.PROPERTY,    name: '香港',     price: 320, rent: [28,150,450,1000,1200,1400],buildCost: 200, colorGroup: 6 },
  { index: 30, type: TileType.PROPERTY,    name: '上海',     price: 350, rent: [35,175,500,1100,1300,1500],buildCost: 200, colorGroup: 7 },
  { index: 31, type: TileType.PROPERTY,    name: '北京',     price: 400, rent: [50,200,600,1400,1700,2000],buildCost: 200, colorGroup: 7 },
];
