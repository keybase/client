## How to build the font icon

- Go to https://icomoon.io
- Add all of font-awesome
- Add all svgs under ./svgs
- Change settings:

```
font name: kb
class prefix: fa-
class postfile:

No checkboxes

CSS Selector: Use attribute selectors
Leave the rest as the defaults

```

- Copy style.css -> desktop/renderer/fonticon.css
- Copy font/kb.ttf -> desktop/renderer/fonts/kb.ttf

## Fixing Vertical Metrics

Go [here](https://www.fontsquirrel.com/tools/webfont-generator)

1. choose expert
1. upload the font
1. only select trueType in the formats
1. remove teh ‘-webfont’ as the suffix
1. check the agree then download
1. rename the file and replace

### For kb.ttf

1. turn off fix missing glyphs
1. turn off subsetting
1. truetype hinting = keep existing

## Update the fonts on the React native side!

```
cd react-native
npm run update-font-icon
```
