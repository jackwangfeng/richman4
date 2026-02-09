#!/usr/bin/env python3
"""Generate walking animation frames for each Richman 4 character using ComfyUI API."""

import json
import uuid
import os
import sys
import time
import urllib.request
import urllib.parse
import random

SERVER = "127.0.0.1:8188"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "characters")

CHARACTERS = [
    {
        "id": "sunxiaomei",
        "name": "孙小美",
        "base_prompt": (
            "a cute young Chinese woman with big sparkling eyes, wearing a pink dress, "
            "cheerful smile, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "atube",
        "name": "阿土伯",
        "base_prompt": (
            "an old Chinese farmer man wearing a straw hat and simple brown clothes, "
            "kind wrinkled face, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "qianfuren",
        "name": "钱夫人",
        "base_prompt": (
            "a wealthy elegant Chinese lady wearing pearl necklace and luxurious fur coat, "
            "sophisticated expression, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "shahongbasi",
        "name": "沙隆巴斯",
        "base_prompt": (
            "a wealthy Arab businessman wearing traditional white thobe and red-white checkered "
            "keffiyeh headscarf, gold jewelry, confident smile with mustache, "
            "cartoon game character design, colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
]

# PLACEHOLDER_WALK_POSES

WALK_POSES = [
    "full body walking pose, left foot stepping forward, right arm swinging forward, dynamic stride",
    "full body walking pose, feet close together mid-stride, arms relaxed at sides, transitioning step",
    "full body walking pose, right foot stepping forward, left arm swinging forward, dynamic stride",
    "full body walking pose, feet close together mid-stride, arms slightly bent, transitioning step",
]


def build_workflow(prompt_text: str, filename_prefix: str, seed: int) -> dict:
    """Build the ComfyUI workflow JSON matching the proven z_image_turbo pipeline."""
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
            "class_type": "VAELoader",
            "inputs": {"vae_name": "ae.safetensors"},
        },
        "4": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {"shift": 3.0, "model": ["1", 0]},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["2", 0], "text": prompt_text},
        },
        "7": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["6", 0]},
        },
        "8": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["8", 0],
                "seed": seed,
                "steps": 4,
                "cfg": 1.0,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["3", 0]},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": filename_prefix},
        },
    }


def queue_prompt(workflow: dict) -> str:
    prompt_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": "gen_walk", "prompt_id": prompt_id}).encode()
    req = urllib.request.Request(f"http://{SERVER}/prompt", data=payload)
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req).read()
    return prompt_id


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"http://{SERVER}/history/{prompt_id}") as resp:
                history = json.loads(resp.read())
            if prompt_id in history:
                entry = history[prompt_id]
                if entry.get("outputs"):
                    return entry
        except Exception:
            pass
        time.sleep(2)
    raise TimeoutError(f"Prompt {prompt_id} did not complete within {timeout}s")


def download_image(filename: str, subfolder: str, folder_type: str) -> bytes:
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"http://{SERVER}/view?{params}") as resp:
        return resp.read()


def remove_background(img_path: str):
    """Remove background from a single image (same logic as remove_bg.py)."""
    from PIL import Image
    import numpy as np
    from scipy import ndimage

    img = Image.open(img_path).convert('RGBA')
    data = np.array(img)
    h, w = data.shape[:2]

    corners = [
        data[0:20, 0:20],
        data[0:20, w-20:w],
        data[h-20:h, 0:20],
        data[h-20:h, w-20:w],
    ]
    bg_color = np.mean(np.concatenate([c.reshape(-1, 4) for c in corners], axis=0), axis=0)[:3]

    rgb = data[:, :, :3].astype(float)
    diff = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))

    threshold = 50
    soft_edge = 20

    bg_mask = diff < (threshold + soft_edge)
    labeled, num_features = ndimage.label(bg_mask)
    border_labels = set()
    border_labels.update(labeled[0, :].tolist())
    border_labels.update(labeled[-1, :].tolist())
    border_labels.update(labeled[:, 0].tolist())
    border_labels.update(labeled[:, -1].tolist())
    border_labels.discard(0)

    edge_bg = np.zeros((h, w), dtype=bool)
    for lbl in border_labels:
        edge_bg |= (labeled == lbl)

    final_alpha = np.full((h, w), 255, dtype=np.uint8)
    # Vectorized version for speed
    bg_pixels = edge_bg & (diff < threshold)
    soft_pixels = edge_bg & (~bg_pixels)
    final_alpha[bg_pixels] = 0
    soft_alpha = np.clip((diff[soft_pixels] - threshold) / soft_edge * 255, 0, 255).astype(np.uint8)
    final_alpha[soft_pixels] = soft_alpha

    data[:, :, 3] = final_alpha
    result = Image.fromarray(data)
    result.save(img_path)
    print(f"    Background removed: {os.path.basename(img_path)}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_seed = random.randint(100000, 999999)
    total = len(CHARACTERS) * len(WALK_POSES)
    count = 0

    for char in CHARACTERS:
        for frame_idx, pose in enumerate(WALK_POSES):
            count += 1
            out_path = os.path.join(OUTPUT_DIR, f"{char['id']}_walk_{frame_idx}.png")

            if os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
                print(f"[{count}/{total}] {char['name']} frame {frame_idx} - already exists, skipping")
                continue

            prompt_text = f"{char['base_prompt']}, {pose}"
            seed = base_seed + hash(f"{char['id']}_{frame_idx}") % 100000

            print(f"[{count}/{total}] Generating {char['name']} walk frame {frame_idx}...")
            workflow = build_workflow(prompt_text, f"richman4_{char['id']}_walk_{frame_idx}", seed)

            prompt_id = queue_prompt(workflow)
            print(f"  Queued prompt {prompt_id}, waiting...")

            entry = wait_for_completion(prompt_id)

            for node_id, node_out in entry["outputs"].items():
                if "images" in node_out:
                    for img_info in node_out["images"]:
                        img_data = download_image(img_info["filename"], img_info.get("subfolder", ""), img_info["type"])
                        with open(out_path, "wb") as f:
                            f.write(img_data)
                        print(f"  Saved: {out_path} ({len(img_data)} bytes)")
                        break
                    break

            # Remove background immediately
            remove_background(out_path)

    print(f"\nDone! Generated {total} walk frames in: {OUTPUT_DIR}")
    for char in CHARACTERS:
        for i in range(len(WALK_POSES)):
            p = os.path.join(OUTPUT_DIR, f"{char['id']}_walk_{i}.png")
            status = "OK" if os.path.exists(p) else "MISSING"
            print(f"  {char['name']} frame {i}: {char['id']}_walk_{i}.png [{status}]")


if __name__ == "__main__":
    main()
