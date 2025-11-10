#!/bin/bash

# Create simple colored square icons using ImageMagick (if available) or Python

cd /counterparty-signer-extension/assets

# Try Python PIL/Pillow
python3 << 'EOF'
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create image with gradient-like color
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Draw a lock symbol
    lock_size = size // 2
    lock_x = (size - lock_size) // 2
    lock_y = (size - lock_size) // 2

    # Lock body (rectangle)
    draw.rectangle(
        [lock_x, lock_y + lock_size//3, lock_x + lock_size, lock_y + lock_size],
        fill='white'
    )

    # Lock shackle (arc approximated with circle)
    draw.ellipse(
        [lock_x + lock_size//4, lock_y, lock_x + lock_size*3//4, lock_y + lock_size//2],
        outline='white',
        width=size//16
    )

    return img

try:
    # Create icons
    icon16 = create_icon(16)
    icon48 = create_icon(48)
    icon128 = create_icon(128)

    # Save
    icon16.save('icon-16.png')
    icon48.save('icon-48.png')
    icon128.save('icon-128.png')

    print("Icons created successfully!")
except Exception as e:
    print(f"Error: {e}")
EOF
