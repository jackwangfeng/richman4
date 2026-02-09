#!/usr/bin/env python3
"""Generate cartoon-style building sprites using ComfyUI.

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

# Building prompts for Q-style/cartoon look
BUILDING_PROMPTS = {
    1: "a cute small green house with red roof, cartoon game asset style, simple design, white background, high quality, richman 4 style, single cottage building",
    2: "two cute small green houses with red roofs side by side, cartoon game asset style, simple design, white background, high quality, richman 4 style",
    3: "three cute small green houses with red roofs in a row, cartoon game asset style, simple design, white background, high quality, richman 4 style",
    4: "four cute small green houses with red roofs arranged in 2x2 grid, cartoon game asset style, simple design, white background, high quality, richman 4 style",
    5: "a cute tall red hotel building with many windows, cartoon game asset style, simple design, white background, high quality, richman 4 style, luxury hotel",
}


def get_workflow(prompt: str, seed: int, filename_prefix: str) -> dict:
    """Create workflow using UNETLoader + CLIPLoader (matching generate_walk_frames.py)."""
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
                "steps": 8,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["2", 0],
                "text": "",
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


def wait_for_completion(prompt_id: str, timeout: int = 120) -> dict:
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

    for level, prompt in BUILDING_PROMPTS.items():
        print(f"\nGenerating building level {level}...")

        filename_prefix = f"building_{level}"
        seed = 42 + level

        workflow = get_workflow(prompt, seed, filename_prefix)

        try:
            prompt_id = queue_prompt(workflow)
            print(f"  Queued prompt: {prompt_id}")

            result = wait_for_completion(prompt_id)

            status = result.get('status', {})
            if status.get('status_str') == 'error':
                print(f"  Error: {status}")
                continue

            # Find and download output image
            outputs = result.get('outputs', {})
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
                        print(f"  Saved: {out_path} ({len(img_data)} bytes)")
                        break
                    break

        except Exception as e:
            print(f"  Error: {e}")

    print(f"\nDone! Check {OUTPUT_DIR}/ for generated buildings.")


if __name__ == "__main__":
    main()
