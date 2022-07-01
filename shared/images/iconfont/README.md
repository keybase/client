* [Building Icon Font](#building-icon-font)
* [Dependencies](#dependencies)
* [Troubleshooting](#troubleshooting)

The complete SVG pipeline is as follows

Sketch Assets → Zeplin → Export to SVG → Optimized with SVGO → Download

It's important to note that the original Sketch assets determine the final SVG
output after running through SVGO. Pay attention for strange overlapping/masking
paths in the final SVGs or inverted colors. This is usually caused by something
happening in Sketch.

The naming convention of the SVG files is very important.

`{counter}-kb-inconfont-{name-with-dashes}-{size}.svg`

The counter is used to generate the unicode values for the characters in the
iconfont. It is okay to have gaps in the counters. It is NOT ok to have
multiple icons with the same counter.

### Building Icon Font

1. Open the [Iconfont](https://zpl.io/29y4w5w) Zeplin sheet
2. Select the icons to add/replace. Then download as SVG
3. Ensure the SVG name is `{counter}-kb-iconfont-{name}-{size}.svg` and there are no collisions in the counters
4. Move SVG to `keybase/client/shared/images/iconfont`
5. Ensure that the icon font dependencies are insatlled wtih `yarn --check-files`
6. Run `yarn update-icon-font`
    * If new icons were added then `shared/common-adapters/icon.constants-gen.tsx` and `shared/fonts/kb.ttf` should be modified
    * If existing icons were modified/replaced then only `shared/fonts/kb.ttf` should be modified
7. Inspect modified `kb.ttf` for SVG artifacts or entirely black boxes for icons
    * Launch `FontForge.app`
    * `File` > `Open` (`cmd` + `O`)
    * Select `$GOPATH/src/github.com/keybase/client/shared/fonts/kb.ttf`
    * Then search for the added/modified icons
    * `View` > `Go To` (`cmd` + `shift` + `>`)
    * Search using `{counter}-kb-iconfont-{name}-{size}.svg` (E.g. `172-kb-iconfont....`)
8. Ensure that no icon in the iconfont is an entirely black box (this occurs if the "icon area" layer is still 100% opaque. It should be transparent even if it has no fill)
9. Ensure that no icon in the iconfont is invereted (icon path & white space are invereted/switch). If this ocurred, then the SVG in Sketch was layerd/grouped/highlihgted incorrectly. Post in #design.

### Dependencies

[fontforge](https://fontforge.github.io/en-US/downloads)

[webfonts-generator](https://github.com/sunflowerdeath/webfonts-generator)

Unfortunately this library is now archived / deprecated. Internally it uses the following packages, which can be used to replace the library if needed.

- **svg** - [svgicons2svgfont](https://github.com/nfroidure/svgicons2svgfont)
- **ttf** - [svg2ttf](https://github.com/fontello/svg2ttf)
- **woff2** - [ttf2woff2](https://github.com/nfroidure/ttf2woff2)
- **woff** - [ttf2woff](https://github.com/fontello/ttf2woff)
- **eot** - [ttf2eot](https://github.com/fontello/ttf2eot)

### Troubleshooting / Other Documentation

[Sketch Best Practices for SVG Export](./SKETCH.md)

[Using Font Forge to Inspect Icon Font Output](./FONTFORGE.md)
