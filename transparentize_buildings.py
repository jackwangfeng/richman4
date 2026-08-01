#!/usr/bin/env python3
"""
建筑素材透明化处理脚本
将建筑图片中的白色背景转换为透明背景
"""

from PIL import Image
import os

def make_transparent(image_path, output_path, threshold=240):
    """
    将图片的白色背景转换为透明
    
    Args:
        image_path: 输入图片路径
        output_path: 输出图片路径
        threshold: 白色阈值 (0-255)
    """
    img = Image.open(image_path).convert('RGBA')
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # 检查是否接近白色
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            # 转换为透明
            new_data.append((item[0], item[1], item[2], 0))
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    img.save(output_path)
    print(f"处理完成: {image_path} -> {output_path}")

def main():
    buildings_dir = "public/buildings"
    
    # 处理每个建筑图片
    for level in range(1, 6):
        input_path = os.path.join(buildings_dir, f"building_{level}.png")
        output_path = os.path.join(buildings_dir, f"building_{level}.png")
        
        if os.path.exists(input_path):
            make_transparent(input_path, output_path)
        else:
            print(f"文件不存在: {input_path}")
    
    print("\n所有建筑素材透明化处理完成！")

if __name__ == "__main__":
    main()
