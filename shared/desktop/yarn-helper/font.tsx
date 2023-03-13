/* eslint-disable sort-keys */
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import prettier from 'prettier'
import crypto from 'crypto'

const commands = {
  'update-icon-font': {
    code: () => updateIconFont(false),
    help: 'Update our font sizes automatically',
  },
  'update-web-font': {
    code: () => updateIconFont(true),
    help: 'Update our web font automatically',
  },
  'update-icon-constants': {
    code: updateIconConstants,
    help: 'Update icon.constants-gen.tsx and icon.css with new/removed files',
  },
  'unused-assets': {
    code: unusedAssetes,
    help: 'Find unused assets',
  },
}

const paths = {
  iconfont: path.resolve(__dirname, '../../images/iconfont'),
  iconPng: path.resolve(__dirname, '../../images/icons'),
  illustrationPng: path.resolve(__dirname, '../../images/illustrations'),
  releasePng: path.resolve(__dirname, '../../images/releases'),
  fonts: path.resolve(__dirname, '../../fonts'),
  webFonts: path.resolve(__dirname, '../../fonts-for-web'),
  webFontsCss: path.resolve(__dirname, '../../fonts-for-web/fonts_custom.styl'),
  iconConstants: path.resolve(__dirname, '../../common-adapters/icon.constants-gen.tsx'),
  iconCss: path.resolve(__dirname, '../../common-adapters/icon.css'),
}

// Locations of all PNG assets to include in icon.constants.gen
const pngAssetDirPaths = [
  {assetDirPath: paths.iconPng, insertFn: insertIconAssets},
  {assetDirPath: paths.illustrationPng, insertFn: insertIllustrationAssets},
  {assetDirPath: paths.releasePng, insertFn: insertReleaseAssets},
]

const fontHeight = 1024
const descentFraction = 16 // Source: https://icomoon.io/#docs/font-metrics
const descent = fontHeight / descentFraction
const baseCharCode = 0xe900

const iconfontRegex = /^(\d+)-kb-iconfont-(.*)-(\d+).svg$/
const computeCounter = (counter: number) => baseCharCode + counter - 1
const mapPaths = (skipUnmatchedFile: boolean) => (path: string) => {
  const match = path.match(iconfontRegex)
  if (!match || match.length !== 4) {
    return skipUnmatchedFile ? undefined : console.error(`Filename did not match, skipping ${path}`)
  }
  const [, counter, name, size] = match

  if (!counter) {
    throw new Error(`Invalid counter for filename ${path}`)
  }

  if (!(size === '8' || size === '16' || size === '24')) {
    throw new Error(`Invalid size for filename ${path} - valid sizes are 8, 16, 24`)
  }

  const score = Number(counter)
  return !isNaN(score) ? {filePath: path, counter: score, name, size} : null
}
const getSvgNames = (
  skipUnmatchedFile: boolean
): Array<{filePath: string; counter: number; name: string; size: string}> =>
  // @ts-ignore codemode issue
  fs
    .readdirSync(paths.iconfont)
    .map(mapPaths(skipUnmatchedFile))
    .filter(Boolean)
    // @ts-ignore codemode issue
    .sort((x, y) => x.counter - y.counter)

const getSvgPaths = (skipUnmatchedFile: boolean) =>
  getSvgNames(skipUnmatchedFile).map(i => path.resolve(paths.iconfont, i.filePath))

/*
 * This function will read all of the SVG files specified above, and generate a
 * single ttf iconfont from the svgs. webfonts-generator will write the file to
 * `dest`.
 *
 * For config options: https://github.com/sunflowerdeath/webfonts-generator
 */
type FontResult = {ttf: string; woff: string; svg: string}
function updateIconFont(web: boolean) {
  if (!web) {
    // Check if fontforge is installed, required to generate the font
    try {
      execSync('fontforge')
    } catch (error_) {
      const error = error_ as {message: string}
      if (error.message.includes('not found')) {
        throw new Error(
          'FontForge is required to generate the icon font. Run `yarn`, install FontForge CLI globally, and try again.'
        )
      }
      throw error
    }
  }

  let webfontsGenerator: (...a: Array<any>) => void
  try {
    webfontsGenerator = require('webfonts-generator')
  } catch (e) {
    console.error('\n\n\n\n>> Web fonts generation is optional, install manually to install it << \n\n\n')
    throw e
  }
  const svgFilePaths = getSvgPaths(true /* print skipped */)
  const svgFilenames = getSvgNames(false /* print skipped */)
  /*
   * NOTE: Since icon counters can be non-sequential, we need to tell our font generator which codepoint to use for each icon.
   * This is done by setting `codepoints` object where the keys are character codes (hexidecimal) and the values are icon names
   *
   * { [name of svg file]: charCode }
   *
   * Example
   * { "127-kb-iconfont-nav-2-files-24": "0xe97e" }
   */
  const seenCounters = new Set()
  const codepointsMap = svgFilenames.reduce((pointsMap, {counter, filePath}) => {
    // Character code value converted from decimal to hexidecimal
    const charCodeHex = computeCounter(counter).toString(16)
    const {name} = path.parse(filePath)
    if (seenCounters.has(counter)) {
      throw new Error(`There are two SVGs with the same index number ${counter}`)
    }
    seenCounters.add(counter)
    return {
      ...pointsMap,
      [name]: `0x${charCodeHex}`,
    }
  }, {})

  if (web) {
    try {
      fs.mkdirSync(paths.webFonts)
    } catch (_) {}
  }

  webfontsGenerator(
    {
      // An intermediate svgfont will be generated and then converted to TTF by webfonts-generator
      types: web ? ['svg', 'ttf', 'woff'] : ['ttf'],
      files: svgFilePaths,
      dest: paths.fonts,
      startCodepoint: baseCharCode,
      fontName: 'kb',
      classSelector: 'icon-kb',
      css: false,
      html: false,
      writeFiles: false,
      codepoints: codepointsMap,
      formatOptions: {
        ttf: {ts: 0, version: `${Date.now()}.0`}, // MUST use a unique version else windows installer does the WRONG THING
        // Setting descent to zero on font generation will prevent the final
        // glyphs from being shifted down
        svg: {
          fontHeight,
          descent: 0,
        },
      },
    },
    (error: unknown, result: FontResult) =>
      error ? fontsGeneratedError(error) : fontsGeneratedSuccess(web, result)
  )
  console.log('Created new font')
}

const fontsGeneratedSuccess = (web: boolean, result: FontResult) => {
  console.log('Generator success')
  if (web) {
    generateWebCSS(result)
  } else {
    console.log('Webfont generated successfully... updating constants and flow types')
    fs.writeFileSync(path.join(paths.fonts, 'kb.ttf'), result.ttf)
    setFontMetrics()
    updateIconConstants()
  }
}

const generateWebCSS = (result: FontResult) => {
  const svgFilenames = getSvgNames(false /* print skipped */)
  const rules: {[key: string]: number} = svgFilenames.reduce((map, {counter, name}) => {
    map[`kb-iconfont-${name}`] = computeCounter(counter)
    return map
  }, {})

  const typeToFormat = {
    ttf: 'truetype',
    woff: 'woff',
    svg: 'svg',
  }

  // hash and write
  const types = (['ttf', 'woff', 'svg'] as const).map(type => {
    const hash = crypto.createHash('md5')
    hash.update(result[type])
    try {
      fs.writeFileSync(path.join(paths.webFonts, `kb.${type}`), result[type])
    } catch (e) {
      console.error(e)
    }
    return {type, hash: hash.digest('hex'), format: typeToFormat[type]}
  })
  const urls = types
    .map(type => `url('/fonts/kb.${type.type}?${type.hash}') format('${type.format}')`)
    .join(',\n')

  const css = `
/*
 This file is how we serve our custom Coinbase, etc., fonts on the website

 ALSO see fonts.styl
 SOURCE:
  1. Go to client and run \`yarn update-web-font\`
  2. Copy client/shared/fonts-for-web/fonts_custom.styl here
  3. Copy fonts to public/fonts
*/

@font-face {
  font-family: "kb";
  src: ${urls};
  font-weight: normal;
  font-style: normal;
}

[class^="icon-kb-iconfont-"], [class*=" icon-kb-iconfont-"] {
  /* use !important to prevent issues with browser extensions that change fonts */
  font-family: 'kb' !important;
  speak: none;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  font-size: 16px;

  /* Better Font Rendering =========== */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${Object.keys(rules)
  .map(
    name => `.icon-${name}:before {
  content: "\\${rules[name].toString(16)}";
}`
  )
  .join('\n')}`

  try {
    fs.writeFileSync(paths.webFontsCss, css, 'utf8')
  } catch (e) {
    console.error(e)
  }
}

const fontsGeneratedError = (error: unknown) => {
  console.log(
    `webfonts-generator failed to generate ttf iconfont file. Check that all svgs exist and the destination directory exits. ${error}`
  )
  process.exit(1)
}

function insertIconAssets(iconFiles: Array<string>) {
  const icons = {}

  // light
  iconFiles
    .filter(i => i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        extension: i.slice(-3),
        imagesDir: `'icons'`,
        isFont: false,
        nameDark: undefined,
        require: `'../images/icons/${i}'`,
        requireDark: undefined,
      }
    })

  // dark
  iconFiles
    .filter(i => i.startsWith('icon-dark-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      const lightName = shortName.replace(/^icon-dark-/, 'icon-')
      if (!icons[lightName]) {
        console.error(`Found a dark icon without a matching light icon! ${lightName} ${i}`)
        process.exit(1)
      }
      icons[lightName].nameDark = `'${shortName}'`
      icons[lightName].requireDark = `'../images/icons/${i}'`
    })

  return icons
}

function insertIllustrationAssets(illustrationFiles) {
  return illustrationFiles.reduce((prevIcons, i) => {
    const shortName = i.slice(0, -4)
    return {
      ...prevIcons,
      [shortName]: {
        extension: i.slice(-3),
        imagesDir: `'illustrations'`,
        isFont: false,
        nameDark: undefined,
        require: `'../images/illustrations/${i}'`,
        requireDark: undefined,
      },
    }
  }, {})
}

function insertReleaseAssets(releaseFiles) {
  return releaseFiles.reduce((prevIcons, i) => {
    const shortName = i.slice(0, -4)
    return {
      ...prevIcons,
      [shortName]: {
        extension: i.slice(-3),
        imagesDir: `'releases'`,
        isFont: false,
        nameDark: undefined,
        require: `'../images/releases/${i}'`,
        requireDark: undefined,
      },
    }
  }, {})
}

function updateIconConstants() {
  console.log('Generating icon constants (from the following directories)')
  console.log('\t*' + pngAssetDirPaths.map(({assetDirPath}) => assetDirPath).join('\n\t*'))

  // Build constants for the png assests.
  const icons = pngAssetDirPaths.reduce((prevIcons, {assetDirPath, insertFn}) => {
    // Don't include @2x and @3x assets in icon-constants-gen.
    // They are included later in srcSet generation by icon.*.tsx
    //
    // On macOS (10.12+) Finder.app will no longer display .DS_Store files. Make sure they are not included here.
    const iconFiles = fs.readdirSync(assetDirPath).filter(i => !i.includes('@') && !i.includes('DS_Store'))
    const newIcons = insertFn(iconFiles)
    return {
      ...prevIcons,
      ...newIcons,
    }
  }, {})

  // Build constants for iconfont svgs
  const svgFilenames = getSvgNames(false /* print skipped */)
  svgFilenames.reduce((_, {counter, name, size}) => {
    return (icons[`iconfont-${name}`] = {
      isFont: true,
      gridSize: size,
      charCode: computeCounter(counter),
    })
  }, {})

  const iconConstants = `// This file is GENERATED by yarn run update-icon-font. DON'T hand edit
  type IconMeta = {
    isFont: boolean
    gridSize?: number
    extension?: string
    charCode?: number
    nameDark?: string
    imagesDir?: string
    require?: string
    requireDark?: string
  }

  export const iconMeta = {
  ${
    /* eslint-disable */
    Object.keys(icons)
      .sort()
      .map(name => {
        const icon = icons[name]
        const meta = [
          icon.charCode ? [`charCode: 0x${icons[name].charCode.toString(16)}`] : [],
          icon.extension ? [`extension: '${icons[name].extension}'`] : [],
          icon.imagesDir ? [`imagesDir: ${icons[name].imagesDir}`] : [],
          icon.gridSize ? [`gridSize: ${icons[name].gridSize}`] : [],
          `isFont: ${icon.isFont}`,
          icon.nameDark ? [`nameDark: ${icons[name].nameDark}`] : [],
          icon.require ? [`get require(): string {return require(${icons[name].require}) as string}`] : [],
          icon.requireDark
            ? [`get requireDark(): string {return require(${icons[name].requireDark}) as string}`]
            : [],
        ]

        return `'${name}': {
            ${meta.filter(x => x.length).join(',\n')}
        } as IconMeta`
      })
      .join(',\n')
  }
  } as const
  export type IconType = keyof typeof iconMeta
  `

  const iconCss = `/* This file is GENERATED by yarn run update-icon-font. DON'T hand edit */
/* Used by icon on desktop to speed up perf */
.icon {
    -webkit-font-smoothing: antialiased;
    font-family: kb;
    font-size: 16px;
    font-style: normal;
    font-variant: normal;
    font-weight: normal;
    line-height: 1;
    speak: none;
    text-transform: none;
    user-select: none;
}

/* Icon types */
${Object.keys(icons).reduce(
  (res, name) =>
    icons[name].isFont
      ? res + `.icon-gen-${name}::before {content: "\\${icons[name].charCode.toString(16)}";}\n`
      : res,
  ''
)}
`

  try {
    fs.writeFileSync(
      paths.iconConstants,
      prettier.format(iconConstants, {
        ...prettier.resolveConfig.sync(paths.iconConstants),
        parser: 'typescript',
      }),
      'utf8'
    )
    fs.writeFileSync(paths.iconCss, iconCss, 'utf8')
  } catch (e) {
    console.error(e)
  }
}

/*
 * The final ttf output from webfonts-generator will not set the GASP or OS2/Metrics table in TTF metadata correctly.
 * GASP will help with pixel alignment and antialiasing
 * OS2/Metrics will set the ascent and descent values in metadata (rather than on the glyphs)
 * To fix this, we need to force the following values using fontforge.
 *
 * ---
 * OS/2 Table
 * Documentation: https://docs.microsoft.com/en-us/typography/opentype/spec/os2ver1
 * ---
 * WinAscent: ${fontHeight - descent + 2}
 * WinDescent: ${descent * 2 + 20}
 * TypoAscent: ${fontHeight - descent}
 * TypoDescent: -${descent}
 * HHeadAscent: ${fontHeight - descent + 2}
 * HHeadDescent: -${descent * 2 + 20}
 *
 * ---
 * GASP Table
 * This is *super* important for anti-aliasing and grid snapping.
 * If this is not set successfully then the icons will be visually blurry.
 * Documentation: https://docs.microsoft.com/en-us/typography/opentype/spec/gasp#sample-gasp-table
 * ---
 * PixelSize: 65535
 * FlagValue:
 *  0 means neither grid-fit nor anti-alias
 *  1 means grid-fit but no anti-alias.
 *  2 means no grid-fit but anti-alias.
 *  3 means both grid-fit and anti-alias.
 *
 */
const setFontMetrics = () => {
  /*
   * Arguments:
   * $1: path to kb.ttf
   * $2: ascent value
   * $3: descent value
   */
  const kbTtf = path.resolve(paths.fonts, 'kb.ttf')
  // Nav icons need to be shifted more because the grid size is 24.
  // Without shifting to -(64 + 21) the nav icons will be aligned on
  // a half pixel which will cause blurriness.
  const icon24 = getSvgNames(true)
    .filter(({size}) => size === '24')
    .map(({filePath}) => `'${filePath.replace('.svg', '')}'`)
  const icon24First = icon24[0]
  const icon24Last = icon24[icon24.length - 1]
  let script = `
  Open('${kbTtf}');
  SetOS2Value('WinAscent', ${fontHeight - descent + 2});
  SetOS2Value('WinDescent', ${descent * 2 + 20});
  SetOS2Value('TypoAscent', ${fontHeight - descent});
  SetOS2Value('TypoLineGap', ${0});
  SetOS2Value('TypoDescent', ${-descent});
  SetOS2Value('HHeadAscent', ${fontHeight - descent + 2});
  SetOS2Value('HHeadDescent', ${-(descent * 2 + 20)});
  SetGasp(65535, 15);
  SelectAll();
  Move(0, ${-descent});
  SelectNone();
  Select(${icon24First}, ${icon24Last});
  Move(0, ${-22});
  ScaleToEm(${fontHeight - descent}, ${descent});
  Generate('${kbTtf}');
  `
  script = script
    .split('\n')
    .map(x => x.trim())
    .join(' ')
  const command = `fontforge -lang ff -c "${script}"`
  try {
    execSync(command, {encoding: 'utf8', env: process.env})
  } catch (e) {
    console.error(e)
  }
}

function unusedAssetes() {
  const allFiles = fs.readdirSync(paths.iconPng)

  // map of root name => [files]
  const images = {}
  allFiles.forEach(f => {
    const parsed = path.parse(f)
    if (!['.jpg', '.png'].includes(parsed.ext)) {
      return
    }

    let root = parsed.name
    const atFiles = root.match(/(.*)@[23]x$/)
    if (atFiles) {
      root = atFiles[1]
    }

    if (!images[root]) {
      images[root] = []
    }
    images[root].push(f)
  })

  Object.keys(images).forEach(image => {
    const command = `ag --ignore "./common-adapters/icon.constants-gen.tsx" "${image}"`
    try {
      execSync(command, {encoding: 'utf8', env: process.env})
    } catch (error_) {
      const error = error_ as any
      if (error.status === 1) {
        console.log(images[image].join('\n'))
      }
    }
  })
}

export default commands
