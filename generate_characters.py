#!/usr/bin/env python3
"""Generate 4 Richman 4 character portraits using local ComfyUI API."""

import json
import uuid
import os
import sys
import time
import urllib.request
import urllib.parse

SERVER = "127.0.0.1:8188"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "characters")

CHARACTERS = [
    {
        "id": "sunxiaomei",
        "name": "孙小美",
        "prompt": (
            "a cute young Chinese woman with big sparkling eyes, wearing a pink dress, "
            "cheerful smile, full body standing pose, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "atube",
        "name": "阿土伯",
        "prompt": (
            "an old Chinese farmer man wearing a straw hat and simple brown clothes, "
            "kind wrinkled face, full body standing pose, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "qianfuren",
        "name": "钱夫人",
        "prompt": (
            "a wealthy elegant Chinese lady wearing pearl necklace and luxurious fur coat, "
            "sophisticated expression, full body standing pose, cartoon game character design, "
            "colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
    {
        "id": "shahongbasi",
        "name": "沙隆巴斯",
        "prompt": (
            "a wealthy Arab businessman wearing traditional white thobe and red-white checkered "
            "keffiyeh headscarf, gold jewelry, confident smile with mustache, full body standing pose, "
            "cartoon game character design, colorful, white background, high quality, detailed, richman 4 style"
        ),
    },
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
    """Queue a prompt and return the prompt_id."""
    prompt_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": "gen_chars", "prompt_id": prompt_id}).encode()
    req = urllib.request.Request(f"http://{SERVER}/prompt", data=payload)
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req).read()
    return prompt_id


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    """Poll /history until the prompt completes."""
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
    """Download a generated image from ComfyUI."""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"http://{SERVER}/view?{params}") as resp:
        return resp.read()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    import random
    base_seed = random.randint(100000, 999999)

    for i, char in enumerate(CHARACTERS):
        out_path = os.path.join(OUTPUT_DIR, f"{char['id']}.png")

        # Skip if already exists
        if os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
            print(f"[{i+1}/4] {char['name']} ({char['id']}) - already exists, skipping")
            continue

        print(f"[{i+1}/4] Generating {char['name']} ({char['id']})...")
        seed = base_seed + i
        workflow = build_workflow(char["prompt"], f"richman4_{char['id']}", seed)

        prompt_id = queue_prompt(workflow)
        print(f"  Queued prompt {prompt_id}, waiting for completion...")

        entry = wait_for_completion(prompt_id)

        # Find the SaveImage output
        for node_id, node_out in entry["outputs"].items():
            if "images" in node_out:
                for img_info in node_out["images"]:
                    img_data = download_image(img_info["filename"], img_info.get("subfolder", ""), img_info["type"])
                    with open(out_path, "wb") as f:
                        f.write(img_data)
                    print(f"  Saved to {out_path} ({len(img_data)} bytes)")
                    break
                break

    print("\nDone! All character images are in:", OUTPUT_DIR)
    for char in CHARACTERS:
        p = os.path.join(OUTPUT_DIR, f"{char['id']}.png")
        exists = "OK" if os.path.exists(p) else "MISSING"
        print(f"  {char['name']}: {char['id']}.png [{exists}]")


if __name__ == "__main__":
    main()
