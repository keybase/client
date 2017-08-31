## How to build the font icon

## Phase 1: Update svgs
- Go to the Icon font zeplin sheet (https://zpl.io/pbL9pM2)
- Export all the icons to this folder
  - On the right panel you can click the assets tab and download all SVGs into this folder.
  - Delete all non-icon font svgs from that folder (anything thats not 'kb-iconfont-.*')

## Phase 2: Get svg paths
- Go to https://icomoon.io
- Create a new empty project [Main Menu -> Manage projects -> New Project]
- Import all the svgs from phase 1 [Import icons]
- Download JSON [Right hamburger menu => Download JSON] and save as kb-icomoon-project-app.json

## Phase 3: Generate fonts
- run `yarn run generate-font-project` (this updates our Icon constants for you)
- On icomoon.io import the generated project [menu -> Projects -> Import Project -> kb-icomoon-project-generated.json]
- Generate font and download
- Unzip kb.zip into `./kb/` in `shared/fonts`.
- run `yarn run apply-new-fonts`
- Delete `./kb/`

## Fixing Vertical Metrics

Go [here](https://www.fontsquirrel.com/tools/webfont-generator)

1. choose expert
1. upload `kb.ttf`
1. only select trueType in the formats
1. remove the ‘-webfont’ as the suffix
1. turn off fix missing glyphs
1. turn off subsetting
1. truetype hinting = keep existing
1. check the agree then download
1. replace `kb.ttf` with the file of the same name from the downloaded zip file

## Update the flowtype and fonts on both apps

1. Go to `shared/`
1. Run ```yarn run updated-fonts```
