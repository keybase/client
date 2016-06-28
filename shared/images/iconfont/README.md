## How to build the font icon

- Go to https://icomoon.io
- Import project file kb-icomoon-project.json
- Save exported svgs from Zeplin to this directory (protip you can export all assets in Zeplin under assets if you don't have anything selected)
- Add new svgs to icomoon
- Ensure settings:

```
font name: kb
class prefix: fa-
class postfile:

No checkboxes

CSS Selector: Use attribute selectors
Leave the rest as the defaults

```

- Edit grid size of icons you've added by clicking the pencil in the top right under selection.
<img width="1308" alt="screen shot 2016-05-24 at 5 07 12 pm" src="https://cloud.githubusercontent.com/assets/594035/15523983/583b52d8-21d3-11e6-8cb7-c146cb30bfb0.png">

- When you get to the font download screen you should see each icon in the correct grid size category (visible in the upper left) like this picture:
<img width="1323" alt="screen shot 2016-05-24 at 5 10 50 pm" src="https://cloud.githubusercontent.com/assets/594035/15523982/583acab6-21d3-11e6-93af-34b680d02f6c.png">

- Copy style.css -> desktop/renderer/fonticon.css
- Copy font/kb.ttf -> desktop/renderer/fonts/kb.ttf

## Fixing Vertical Metrics

Go [here](https://www.fontsquirrel.com/tools/webfont-generator)

1. choose expert
1. upload the font
1. only select trueType in the formats
1. remove the ‘-webfont’ as the suffix
1. check the agree then download
1. rename the file and replace

### For kb.ttf

1. turn off fix missing glyphs
1. turn off subsetting
1. truetype hinting = keep existing

## Update the flowtype and fonts on the React native side!

1. Add new icons to shared/common-adapters/icon.js.flow
1. Regen react-native icon paths

    ```
    cd react-native
    npm run update-font-icon
    ```

## Update the flowtype and fonts on the electron side!

1. Run ```npm run updated-fonts```
