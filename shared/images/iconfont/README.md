## How to build the font icon

## Phase 1: Get svg paths
- Go to https://icomoon.io
- Create a new empty project [Main Menu -> Manage projects -> New Project]
- Import all the svgs [Import icons]
- Download JSON [Right hamburger menu => Download JSON] and save as kb-icomoon-project-app.json

## Phase 2: Generate fonts
- run `yarn run generate-font-project` (this updates our Icon constants for you)
- On icomoon.io import the generated project [menu -> Projects -> Import Project -> kb-icomoon-project-generated.json]
- Generate font and download
- Unzip kb.zip into this folder
- run `yarn run apply-new-fonts`
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

1. Go to /shared
1. Run ```yarn run updated-fonts```
