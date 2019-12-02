#/usr/bin/env python3
import glob
import fontforge

for filename in glob.glob('./keybase*.ttf'):
    font = fontforge.open(filename)
    font.upos += 200
    font.generate(font.path)
