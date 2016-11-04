## How to build the font icon

## Phase 1: Get svg paths
- Go to https://icomoon.io
- Create a new empty project and import all our svg files using menu -> Manage projects -> New Project
- Save the project as kb-icomoon-project-app.json
## Phase 2: Generate fonts
- run `npm run generate-font-project` (this updates our Icon constants for you)
- In webapp Import project file kb-icomoon-project-generated.json, using menu -> Projects -> Import Project
- Copy kb.zip to this folder as `kb`
- run `npm run apply-new-fonts`
- Delete `./kb/`

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

## Update the flowtype and fonts on both apps

1. Go to /desktop
1. Run ```npm run updated-fonts```
