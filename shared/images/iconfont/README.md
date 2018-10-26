## How to build the font icon

#Note: Make sure you scroll all the way to the bottom of the Zeplin screen before exporting the assets, otherwise they might not load.## Dependencies

[webfont-generator](https://github.com/sunflowerdeath/webfonts-generator)

[fontforge](https://fontforge.github.io/en-US/downloadsj)
- Mac: `brew install fontforge`
- Window: Install the GUI application and the executable should be available via
  the command line.

### Instructions

1. Delete all icons from this folder
2. Download iconfont svgs from this [zeplin sheet](https://zpl.io/29y4w5w)
3. Optionally if there are PNG assets to update, download from this [zeplin sheet](https://zpl.io/VQoMDq4)
    - Note: **Make sure you scroll all the way to the bottom of the Zeplin screen before exporting the assets, otherwise they might not load.**
4. Move assets to the appropriate directory
    - svg iconfonts: `client/shared/images/iconfont`
    - png assets: `client/shared/images/icons`
5. Generate the iconfont and update constants on both apps
    - `yarn update-icon-font` Will generate a font file and update the constants
      - font: `client/shared/fonts/kb.ttf`
      - constants: `client/shared/common-adapters/icon.constants`
    - `yarn update-icon-constants` will only update the constants


### Notes on SVG output

The SVG export flow looks like this

Sketch Assets → Zeplin → Export to SVG → Optimized with SVGO → Download

It's important to note that the original Sketch assets determine the final SVG
output after running through SVGO. Pay attention for strange overlapping/masking
paths in the final SVGs or inverted colors. This is usually caused by something
happening in Sketch.

The naming convention of the SVG files is very important.

`{counter}-kb-inconfont-{name-with-dashes}-{size}.svg`

The counter is used to generate the unicode values for the characters in the
iconfont. It is okay to have gaps in the counters.

For instructions on adding/modifying icons look at the instructions in this
[zeplin sheet](https://zpl.io/29y4w5w).

### Notes on Icon Generation

[NOTES.md](NOTES.md)

### Debugging

- If flow complains with the following error, it's likely because the svg file
  is missing one of the values in the naming convention above ({counter}
  {name-with-dashes} or {size}).

```
Error ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ provision/code-page/index.js:181:19

Cannot create Icon element because:
 • property iconfont-qr-code is missing in typeof iconMeta_ [1] in property type.
 • property iconfont-text-code is missing in typeof iconMeta_ [1] in property type.
```
