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
    help: 'Update icon.constants.js and icon.css with new/removed files',
  },
  'unused-assets': {
    code: unusedAssetes,
    help: 'Find unused assets',
  },
}

const paths = {
  iconfont: path.resolve(__dirname, '../../images/iconfont'),
  iconpng: path.resolve(__dirname, '../../images/icons'),
  fonts: path.resolve(__dirname, '../../fonts'),
  webFonts: path.resolve(__dirname, '../../fonts-for-web'),
  webFontsCss: path.resolve(__dirname, '../../fonts-for-web/fonts_custom.styl'),
  iconConstants: path.resolve(__dirname, '../../common-adapters/icon.constants.tsx'),
  iconCss: path.resolve(__dirname, '../../common-adapters/icon.css'),
}

const fontHeight = 1024
const descentFraction = 16 // Source: https://icomoon.io/#docs/font-metrics
const descent = fontHeight / descentFraction
const baseCharCode = 0xe900

const iconfontRegex = /^(\d+)-kb-iconfont-(.*)-(\d+).svg$/
const mapPaths = skipUnmatchedFile => path => {
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

const getSvgPaths = skipUnmatchedFile =>
  getSvgNames(skipUnmatchedFile).map(i => path.resolve(paths.iconfont, i.filePath))

/*
 * This function will read all of the SVG files specified above, and generate a
 * single ttf iconfont from the svgs. webfonts-generator will write the file to
 * `dest`.
 *
 * For config options: https://github.com/sunflowerdeath/webfonts-generator
 */
function updateIconFont(web) {
  if (!web) {
    // Check if fontforge is installed, required to generate the font
    try {
      execSync('fontforge')
    } catch (e) {
      if (e.message.includes('not found')) {
        throw new Error(
          'FontForge is required to generate the icon font. Run `yarn`, install FontForge CLI globally, and try again.'
        )
      }
      throw e
    }
  }

  let webfontsGenerator
  try {
    webfontsGenerator = require('webfonts-generator')
  } catch (e) {
    console.error(
      '\n\n\n\n>> Web fonts generation is optional, run a full yarn (and not yarn modules) to install it << \n\n\n'
    )
    throw e
  }
  const svgFilePaths = getSvgPaths(true /* print skipped */)

  if (web) {
    try {
      fs.mkdirSync(paths.webFonts)
    } catch (_) {}
  }

  webfontsGenerator(
    {
      // An intermediate svgfont will be generated and then converted to TTF by webfonts-generator
      types: web ? ['ttf', 'woff', 'svg'] : ['ttf'],
      files: svgFilePaths,
      dest: paths.fonts,
      startCodepoint: baseCharCode,
      fontName: 'kb',
      classSelector: 'icon-kb',
      css: false,
      html: false,
      writeFiles: false,
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
    (error, result) => (error ? fontsGeneratedError(error) : fontsGeneratedSuccess(web, result))
  )
  console.log('Created new font')
}

const fontsGeneratedSuccess = (web, result) => {
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

const generateWebCSS = result => {
  const svgFilenames = getSvgNames(false /* print skipped */)
  const rules = svgFilenames.reduce((map, {counter, name}) => {
    map[`kb-iconfont-${name}`] = baseCharCode + counter - 1
    return map
  }, {})

  const typeToFormat = {
    ttf: 'truetype',
    woff: 'woff',
    svg: 'svg',
  }

  // hash and write
  const types = ['ttf', 'woff', 'svg'].map(type => {
    var hash = crypto.createHash('md5')
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
  .join('\n')}
`

  try {
    fs.writeFileSync(paths.webFontsCss, css, 'utf8')
  } catch (e) {
    console.error(e)
  }
}

const fontsGeneratedError = error => {
  console.log(
    `webfonts-generator failed to generate ttf iconfont file. Check that all svgs exist and the destination directory exits. ${error}`
  )
  process.exit(1)
}

function updateIconConstants() {
  console.log('Generating icon constants')

  const icons = {}

  // Build constants for the png assests.
  fs.readdirSync(paths.iconpng)
    .filter(i => i.indexOf('@') === -1 && i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        extension: i.slice(-3),
        isFont: false,
        require: `'../images/icons/${i}'`,
      }
    })

  // Build constants for iconfont svgs
  const svgFilenames = getSvgNames(false /* print skipped */)
  svgFilenames.reduce((_, {counter, name, size}) => {
    return (icons[`iconfont-${name}`] = {
      isFont: true,
      gridSize: size,
      charCode: baseCharCode + counter - 1,
    })
  }, {})

  const iconConstants = `// This file is GENERATED by yarn run update-icon-font. DON'T hand edit
  type IconMeta = {
    isFont: boolean
    gridSize?: number
    extension?: string
    charCode?: number
    require?: string
  }

  const iconMeta_ = {
  ${
    /* eslint-disable */
    Object.keys(icons)
      .sort()
      .map(name => {
        const icon = icons[name]
        const meta = [
          icon.charCode ? [`charCode: 0x${icons[name].charCode.toString(16)}`] : [],
          icon.extension ? [`extension: '${icons[name].extension}'`] : [],
          icon.gridSize ? [`gridSize: ${icons[name].gridSize}`] : [],
          `isFont: ${icon.isFont}`,
          icon.require ? [`require: require(${icons[name].require})`] : [],
        ]

        return `'${name}': {
            ${meta.filter(x => x.length).join(',\n')}
        }`
      })
      .join(',\n')
  }/* eslint-enable */
  }

  export type IconType = keyof typeof iconMeta_
  export const iconMeta: {[k in IconType]: IconMeta} = iconMeta_
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
  const allFiles = fs.readdirSync(paths.iconpng)

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
    const command = `ag --ignore "./common-adapters/icon.constants.js" "${image}"`
    try {
      execSync(command, {encoding: 'utf8', env: process.env})
    } catch (e) {
      if (e.status === 1) {
        console.log(images[image].join('\n'))
      }
    }
  })
}

export default commands
