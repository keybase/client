#/usr/bin/env python3
import os
import fontforge

for filename in os.listdir('.'):
    if not filename.endswith('.ttf'):
        continue

    font = fontforge.open(filename)
    if font.os2_version != 4:
        # Changing this fixes vertical alignment / descenders being cut off on Android.
        font.os2_version = 4
        font.generate(font.path)
        print('fixed {}'.format(filename))
