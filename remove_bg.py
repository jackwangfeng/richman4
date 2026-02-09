#!/usr/bin/env python3
"""Remove backgrounds from character images, making them transparent PNGs."""

from PIL import Image
import numpy as np
import os

CHAR_DIR = os.path.join(os.path.dirname(__file__), 'public', 'characters')

def remove_background(img_path: str):
    """Remove background by flood-filling from corners with transparency."""
    img = Image.open(img_path).convert('RGBA')
    data = np.array(img)
    h, w = data.shape[:2]

    # Sample background color from corners (average of 20x20 corner patches)
    corners = [
        data[0:20, 0:20],
        data[0:20, w-20:w],
        data[h-20:h, 0:20],
        data[h-20:h, w-20:w],
    ]
    bg_color = np.mean(np.concatenate([c.reshape(-1, 4) for c in corners], axis=0), axis=0)[:3]

    # Calculate color distance from background for each pixel
    rgb = data[:, :, :3].astype(float)
    diff = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))

    # Create alpha mask: pixels close to bg color become transparent
    threshold = 50
    soft_edge = 20
    alpha = np.clip((diff - threshold) / soft_edge * 255, 0, 255).astype(np.uint8)

    # Also do a flood fill from edges to only remove connected background
    from scipy import ndimage
    bg_mask = diff < (threshold + soft_edge)
    # Label connected components
    labeled, num_features = ndimage.label(bg_mask)
    # Find labels that touch the border
    border_labels = set()
    border_labels.update(labeled[0, :].tolist())
    border_labels.update(labeled[-1, :].tolist())
    border_labels.update(labeled[:, 0].tolist())
    border_labels.update(labeled[:, -1].tolist())
    border_labels.discard(0)

    # Only make border-connected background regions transparent
    edge_bg = np.zeros((h, w), dtype=bool)
    for lbl in border_labels:
        edge_bg |= (labeled == lbl)

    # For edge-connected bg pixels, use soft alpha based on distance
    final_alpha = np.full((h, w), 255, dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            if edge_bg[y, x]:
                d = diff[y, x]
                if d < threshold:
                    final_alpha[y, x] = 0
                else:
                    final_alpha[y, x] = min(255, int((d - threshold) / soft_edge * 255))

    data[:, :, 3] = final_alpha
    result = Image.fromarray(data)
    result.save(img_path)
    print(f"  Processed: {os.path.basename(img_path)}")

def main():
    files = ['sunxiaomei.png', 'atube.png', 'qianfuren.png', 'shahongbasi.png']
    print("Removing backgrounds from character images...")
    for f in files:
        path = os.path.join(CHAR_DIR, f)
        if os.path.exists(path):
            remove_background(path)
        else:
            print(f"  Skipped (not found): {f}")
    print("Done!")

if __name__ == '__main__':
    main()
