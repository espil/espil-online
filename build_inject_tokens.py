#!/usr/bin/env python3
"""
Vercel build script: injects MAPBOX_TOKEN and OPENWEATHER_KEY from environment variables.
"""
import os
import sys

def main():
    mapbox_token = os.environ.get('MAPBOX_TOKEN', '')
    openweather_key = os.environ.get('OPENWEATHER_KEY', '')
    
    if not mapbox_token:
        print("WARNING: MAPBOX_TOKEN not set", file=sys.stderr)
    if not openweather_key:
        print("WARNING: OPENWEATHER_KEY not set", file=sys.stderr)
    
    # vancouver.html (production)
    vancouver_path = 'vancouver.html'
    try:
        with open(vancouver_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if mapbox_token:
            content = content.replace('__PUT_YOUR_MAPBOX_TOKEN_HERE__', mapbox_token)
        with open(vancouver_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {vancouver_path}")
    except FileNotFoundError:
        print(f"Skip {vancouver_path} (not found)", file=sys.stderr)
    
    # cauldron/static-config.js (if exists)
    config_path = 'cauldron/static-config.js'
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if mapbox_token:
            content = content.replace('__PUT_YOUR_MAPBOX_TOKEN_HERE__', mapbox_token)
        if openweather_key:
            content = content.replace('__PUT_YOUR_OPENWEATHER_KEY_HERE__', openweather_key)
        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {config_path}")
    except FileNotFoundError:
        print(f"Skip {config_path} (not found)", file=sys.stderr)

if __name__ == '__main__':
    main()
