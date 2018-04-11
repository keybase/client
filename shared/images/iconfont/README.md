## How to build the font icon

## Phase 1: Update svgs
1. Delete all svg files from this folder
1. Go to the Icon font [zeplin sheet](https://app.zeplin.io/project/56a15d74e1e098dd3116d10b/screen/5a2876af3f178f005f0f6409)
1. Export all the icons to this folder
    1. On the right panel you can click the assets tab and download all SVGs into this folder.
    1. Delete all non-icon font svgs from that folder (anything that's not 'kb-iconfont-.*')
        * hint: `find . -type f ! -name 'kb-iconfont-*' -name '*.svg' -delete`

## Phase 2: Get svg paths
1. Go to https://icomoon.io
1. Create a new empty project [Main Menu -> Manage projects -> New Project]
1. Import all the svgs from phase 1 [Import icons]
1. Download JSON [Right hamburger menu => Download JSON] and save as kb-icomoon-project-app.json

## Phase 3: Generate fonts
1. run `yarn run generate-font-project` (this updates our Icon constants for you)
1. On icomoon.io import the generated project [menu -> Projects -> Import Project -> kb-icomoon-project-generated.json]
1. Click Load on the new project row (it should select all the icons)
1. Generate font, replace 'icomoon' with 'kb' in [gear icon > Font Name], and download
1. Unzip kb.zip into `./kb/` in `shared/images/iconfont`.
1. run `yarn run apply-new-fonts`

## Phase 4: Fix Vertical Metrics

Go [here](https://www.fontsquirrel.com/tools/webfont-generator)

1. choose expert
1. upload `kb.ttf`
1. only select trueType in the formats
1. truetype hinting = keep existing
1. turn off fix missing glyphs
1. turn off subsetting
1. remove the ‘-webfont’ as the suffix
1. check the agree then download
1. replace `shared/fonts/kb.ttf` with the file of the same name from the downloaded zip file

## Phase 5: Update the flowtype and fonts on both apps

1. Delete `shared/images/iconfont/kb/`
1. Go to `shared/`
1. Run ```yarn run updated-fonts``` (it's okay if this doesn't do anything)
