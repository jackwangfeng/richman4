#!/usr/bin/env python3
"""Generate beautiful pseudo-3D building sprites using ComfyUI.

Creates detailed isometric-style buildings that get taller with each level.
Level 1: Small cottage (1 floor)
Level 2: Two-story house (2 floors)
Level 3: Three-story apartment (3 floors)
Level 4: Four-story building (4 floors)
Level 5: Luxury hotel skyscraper (5 floors)

Usage:
    python generate_buildings_comfyui.py

Requires ComfyUI running at http://127.0.0.1:8188
"""

import json
import urllib.request
import urllib.parse
import os
import time
import uuid

COMFYUI_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "public/buildings"

BUILDING_PROMPTS = {
    1: """isometric view of a cute small single-floor green cottage house, 
pseudo-3D game asset, cartoon style, richman board game style,
triangular brown roof with chimney, two small windows, wooden door,
detailed textures, soft shadows, clean white background,
vibrant colors, high quality, 3d rendered style, cute and charming""",

    2: """isometric view of a cute two-story green house building,
pseudo-3D game asset, cartoon style, richman board game style,
triangular brown roof with chimney, four windows (two per floor), wooden door,
detailed textures, soft shadows, clean white background,
building height shows two distinct floors, vibrant colors, high quality""",

    3: """isometric view of a cute three-story green apartment building,
pseudo-3D game asset, cartoon style, richman board game style,
triangular brown roof, six windows (two per floor), wooden door,
small balconies on upper floors, detailed textures, soft shadows,
clean white background, building shows three distinct floors, vibrant colors""",

    4: """isometric view of a cute four-story green building,
pseudo-3D game asset, cartoon style, richman board game style,
flat brown roof with small decorative elements, eight windows, wooden door,
balconies on some floors, detailed textures, soft shadows,
clean white background, building shows four distinct floors, vibrant colors""",

    5: """isometric view of a luxury red hotel skyscraper building,
pseudo-3D game asset, cartoon style, richman board game style,
five floors tall, flat red roof with flags, many golden-lit windows,
grand entrance door, hotel sign, detailed architecture,
soft shadows, clean white background, vibrant red and gold colors,
impressive tall building, high quality 3d rendered style""",
}

NEGATIVE_PROMPT = """blurry, low quality, distorted, ugly, deformed, 
bad anatomy, extra limbs, watermark, text, signature, 
realistic photo, dark, gloomy, messy, cluttered"""


def get_workflow(prompt: str, negative: str, seed: int, filename_prefix: str) -> dict:
    """Create workflow using UNETLoader + CLIPLoader."""
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "z_image_turbo_bf16.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b.safetensors",
                "type": "lumina2",
                "device": "default",
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["2", 0],
                "text": prompt,
            },
        },
        "4": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": 512,
                "height": 512,
                "batch_size": 1,
            },
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["3", 0],
                "negative": ["6", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": 12,
                "cfg": 2.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["2", 0],
                "text": negative,
            },
        },
        "7": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "ae.safetensors",
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["7", 0],
            },
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": filename_prefix,
                "images": ["8", 0],
            },
        },
    }


def queue_prompt(workflow: dict) -> str:
    """Submit workflow to ComfyUI and return prompt_id."""
    data = json.dumps({"prompt": workflow}).encode('utf-8')
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data)
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read())
        return result['prompt_id']


def get_history(prompt_id: str) -> dict:
    """Get execution history for a prompt."""
    with urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}") as response:
        return json.loads(response.read())


def wait_for_completion(prompt_id: str, timeout: int = 180) -> dict:
    """Wait for prompt to complete and return history."""
    start = time.time()
    while time.time() - start < timeout:
        history = get_history(prompt_id)
        if prompt_id in history:
            status = history[prompt_id].get('status', {})
            if status.get('completed') or status.get('status_str') == 'error':
                return history[prompt_id]
        time.sleep(1)
    raise TimeoutError(f"Prompt {prompt_id} did not complete in {timeout}s")


def download_image(filename: str, subfolder: str, folder_type: str) -> bytes:
    """Download image from ComfyUI."""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"{COMFYUI_URL}/view?{params}") as response:
        return response.read()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("Generating Pseudo-3D Building Sprites with ComfyUI")
    print("=" * 60)
    print(f"ComfyUI URL: {COMFYUI_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    building_names = {
        1: "小屋 (Cottage) - 1 floor",
        2: "双层洋房 (Two-story House) - 2 floors",
        3: "三层公寓 (Three-story Apartment) - 3 floors",
        4: "四层大厦 (Four-story Building) - 4 floors",
        5: "豪华酒店 (Luxury Hotel) - 5 floors",
    }

    for level in sorted(BUILDING_PROMPTS.keys()):
        prompt = BUILDING_PROMPTS[level]
        print(f"\n[{level}/5] Generating: {building_names[level]}")
        print(f"  Prompt: {prompt[:80]}...")

        filename_prefix = f"building_{level}"
        seed = 1000 + level * 100

        workflow = get_workflow(prompt, NEGATIVE_PROMPT, seed, filename_prefix)

        try:
            prompt_id = queue_prompt(workflow)
            print(f"  Queued: {prompt_id}")

            result = wait_for_completion(prompt_id)

            status = result.get('status', {})
            if status.get('status_str') == 'error':
                print(f"  Error: {status}")
                continue

            outputs = result.get('outputs', {})
            saved = False
            for node_id, node_output in outputs.items():
                if 'images' in node_output:
                    for img_info in node_output['images']:
                        img_data = download_image(
                            img_info['filename'],
                            img_info.get('subfolder', ''),
                            img_info['type']
                        )
                        out_path = os.path.join(OUTPUT_DIR, f"building_{level}.png")
                        with open(out_path, 'wb') as f:
                            f.write(img_data)
                        print(f"  Saved: {out_path} ({len(img_data):,} bytes)")
                        saved = True
                        break
                    if saved:
                        break

        except Exception as e:
            print(f"  Error: {e}")

    print("\n" + "=" * 60)
    print(f"Done! Check {OUTPUT_DIR}/ for generated buildings.")
    print("=" * 60)


if __name__ == "__main__":
    main()
