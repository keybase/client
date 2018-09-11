#/usr/bin/env python3
import glob
import fontforge

for filename in glob.glob('./OpenSans*.ttf'):
    font = fontforge.open(filename)

    font.os2_version = 4

    # Use typo metrics (affects Android, not iOS)
    font.os2_use_typo_metrics = True

    # Use relative units
    font.os2_typoascent_add = 1
    font.os2_typodescent_add = 1

    # Hack: offset ascent and descent to fix Android alignment of single lines
    font.os2_typoascent = 250 + 43 - 70
    font.os2_typodescent = -250 - 45 - 70

    font.generate(font.path)
    print('adjusted {}'.format(filename))
