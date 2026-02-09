#!/usr/bin/env python3
"""Generate character voice lines for 大富翁4 using Edge TTS.

Usage:
    pip install edge-tts
    python generate_voices.py

Outputs MP3 files to public/voices/{characterId}/{voiceId}.mp3
"""

import asyncio
import os
import edge_tts

# Character voice configurations
CHARACTERS = {
    "sunxiaomei": {
        "voice": "zh-CN-XiaoyiNeural",
        "lines": {
            "select":      "选我选我！我最厉害啦！",
            "turnStart":   "轮到我啦，好开心！",
            "roll":        "走你！看我掷个大的！",
            "buyProperty": "这块地我要了！好漂亮呀！",
            "payRent":     "好贵啊，心疼死了！",
            "getRent":     "交租金吧，嘻嘻！",
            "passGo":      "发工资啦，太棒了！",
            "goToJail":    "不要啊！人家不想进去！",
            "escapeJail":  "自由了！外面的空气真好！",
            "chancePlus":  "运气真好！今天是幸运日！",
            "chanceMinus": "倒霉，怎么会这样嘛！",
            "bankrupt":    "呜呜，我破产了...",
            "win":         "我赢了！我是最棒的！",
        },
    },
    "atube": {
        "voice": "zh-CN-YunxiaNeural",
        "lines": {
            "select":      "老汉来也！选我准没错！",
            "turnStart":   "该俺了，看俺的！",
            "roll":        "转转转！给俺来个六！",
            "buyProperty": "这地不错，买下来种田！",
            "payRent":     "又要交钱，俺的血汗钱啊！",
            "getRent":     "谢谢惠顾，常来常往！",
            "passGo":      "又到发薪日，真好！",
            "goToJail":    "冤枉啊！俺是清白的！",
            "escapeJail":  "终于出来了，想死俺了！",
            "chancePlus":  "哈哈，老天有眼！",
            "chanceMinus": "唉，命苦啊...",
            "bankrupt":    "完蛋了，俺的家底全没了...",
            "win":         "哈哈哈，俺赢了！",
        },
    },
    "qianfuren": {
        "voice": "zh-CN-XiaoxiaoNeural",
        "lines": {
            "select":      "就选本夫人吧，不会让你失望的。",
            "turnStart":   "轮到本夫人了，各位请看好。",
            "roll":        "本夫人手气一向很好。",
            "buyProperty": "这块地段不错，买下来！",
            "payRent":     "这点租金，小意思。",
            "getRent":     "承蒙惠顾，多谢多谢。",
            "passGo":      "又到了收入的时候，真好。",
            "goToJail":    "岂有此理！本夫人怎能进这种地方！",
            "escapeJail":  "哼，终于恢复自由了。",
            "chancePlus":  "运气不错，本夫人果然有福气。",
            "chanceMinus": "真是扫兴...",
            "bankrupt":    "不可能...本夫人怎么会破产...",
            "win":         "本夫人赢了，理所当然。",
        },
    },
    "shahongbasi": {
        "voice": "zh-CN-YunjianNeural",
        "lines": {
            "select":      "选我！做生意我最在行！",
            "turnStart":   "看我的，好戏开场了！",
            "roll":        "骰子骰子，给我好运！",
            "buyProperty": "好地段，果断拿下！",
            "payRent":     "又要交钱，真是肉疼！",
            "getRent":     "交租金吧，做生意嘛！",
            "passGo":      "发工资了，钱来了钱来了！",
            "goToJail":    "这一定是误会！我是正经商人！",
            "escapeJail":  "自由真好，继续做生意！",
            "chancePlus":  "哈哈，财运亨通！",
            "chanceMinus": "怎么回事，亏了亏了！",
            "bankrupt":    "我破产了...这不可能...",
            "win":         "我赢了！商业之王就是我！",
        },
    },
}


OUTPUT_DIR = "public/voices"


async def generate_voice(voice: str, text: str, output_path: str):
    """Generate a single voice line."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"  Generated: {output_path}")


async def main():
    total = 0
    for char_id, config in CHARACTERS.items():
        voice = config["voice"]
        lines = config["lines"]
        print(f"\nGenerating voices for {char_id} ({voice})...")
        for line_id, text in lines.items():
            output_path = os.path.join(OUTPUT_DIR, char_id, f"{line_id}.mp3")
            await generate_voice(voice, text, output_path)
            total += 1
    print(f"\nDone! Generated {total} voice files.")


if __name__ == "__main__":
    asyncio.run(main())
