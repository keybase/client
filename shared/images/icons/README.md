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

Update the fonts on the React native side!


```
cd react-native
npm run update-font-icon
```
