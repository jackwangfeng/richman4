# 项目架构总结 (Project Architecture Summary)

这是一个基于 **TypeScript** 开发的类“大富翁”（Monopoly）风格的多人在线桌面游戏项目。项目采用了前后端分离的架构，并深度集成了 AI 辅助的资源生成流程。

## 1. 核心技术栈 (Tech Stack)
*   **前端**: TypeScript，使用自定义渲染引擎（见 `src/render`）。
*   **后端**: Node.js (TypeScript)，负责房间管理和实时通信。
*   **资源生成**: Python 脚本（利用 ComfyUI 或其他 AI 工具自动化生成建筑、角色及语音资产）。

## 2. 目录架构 (Directory Structure)
### `src/` (客户端核心逻辑)
*   **`core/`**: 游戏逻辑中枢，包含游戏引擎 (`GameEngine`)、棋盘逻辑 (`Board`)、骰子 (`Dice`) 以及 AI 模块（集成 `GeminiAI`）。
*   **`render/`**: 渲染层，负责棋盘、角色（Token）、UI 和动画的显示。
*   **`net/`**: 网络层，处理 WebSocket 连接及大厅 (`LobbyUI`) 逻辑。
*   **`audio/`**: 音频管理，控制音效和角色配音。
*   **`shared/`**: 前后端通用的通信协议定义 (`protocol.ts`)。

### `server/` (服务端逻辑)
*   负责 WebSocket 房间管理 (`RoomManager`)、客户端连接 (`ClientConnection`) 和游戏状态同步。

### `public/` (静态资源)
*   包含游戏所需的建筑图片、角色行走图（Walk frames）以及角色的各类语音文件。

### 根目录脚本 (资产流水线)
*   一系列 `generate_*.py` 脚本（如 `generate_buildings.py`, `generate_voices.py` 等），用于自动化生成游戏美术和音效资源。

## 3. 架构特点 (Key Features)
*   **模块化设计**: 逻辑、渲染、音频和网络层清晰分离，高度解耦。
*   **AI 驱动**: 既包含游戏内的 AI 玩家逻辑，也包含开发阶段的 AI 资产生成工作流。
*   **实时多人**: 基于 WebSocket 的房间制联网对战。
*   **协议驱动**: 通过 `shared/protocol.ts` 确保前后端通信契约的一致性。
