
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const commands = {
  'update-icon-constants': {
    code: updateIconConstants,
    help: 'Update icon.constants-gen.tsx and icon.css with new/removed files',
  },
}

const paths = {
  iconfont: path.resolve(__dirname, '../../images/iconfont'),
  iconPng: path.resolve(__dirname, '../../images/icons'),
  illustrationPng: path.resolve(__dirname, '../../images/illustrations'),
  iconConstants: path.resolve(__dirname, '../../common-adapters/icon.constants-gen.shared.tsx'),
  iconConstantsdts: path.resolve(__dirname, '../../common-adapters/icon.constants-gen.d.ts'),
  iconCss: path.resolve(__dirname, '../../common-adapters/icon.css'),
}

// Locations of all PNG assets to include in icon.constants.gen
const pngAssetDirPaths = [
  {assetDirPath: paths.iconPng, insertFn: insertIconAssets},
  {assetDirPath: paths.illustrationPng, insertFn: insertIllustrationAssets},
]

const baseCharCode = 0xe900

const iconfontRegex = /^(\d+)-kb-iconfont-(.*)-(\d+).svg$/
const computeCounter = (counter: number) => baseCharCode + counter - 1
type Infos = {
  filePath: string
  counter: number
  name?: string
  size: string
}
const mapPaths =
  (skipUnmatchedFile: boolean) =>
  (path: string | undefined | null): Infos | undefined => {
    if (!path) {
      throw new Error('invalid path')
    }
    const match = path.match(iconfontRegex)
    if (match?.length !== 4) {
      if (!skipUnmatchedFile) console.error(`Filename did not match, skipping ${path}`)
      return undefined
    }
    const [, counter, name, size] = match

    if (!counter) {
      throw new Error(`Invalid counter for filename ${path}`)
    }

    if (!(size === '8' || size === '16' || size === '24')) {
      throw new Error(`Invalid size for filename ${path} - valid sizes are 8, 16, 24`)
    }

    const score = Number(counter)
    return !isNaN(score) ? {filePath: path, counter: score, name, size} : undefined
  }
const getSvgNames = (skipUnmatchedFile: boolean) => {
  const mp = mapPaths(skipUnmatchedFile)
  return fs
    .readdirSync(paths.iconfont)
    .reduce((arr, p) => {
      const info = mp(p)
      if (info) {
        arr.push(info)
      }
      return arr
    }, new Array<Infos>())
    .sort((x, y) => x.counter - y.counter)
}

type IconInfo = {
  extension?: string
  imagesDir?: string
  isFont: boolean
  gridSize?: string
  charCode?: number
  nameDark?: string
  require?: string
  requireDark?: string
}
function insertIconAssets(iconFiles: Array<string>) {
  const icons: {[key: string]: IconInfo} = {}

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
      const icon = icons[lightName]
      if (!icon) {
        console.error(`Found a dark icon without a matching light icon! ${lightName} ${i}`)
        process.exit(1)
      }
      icon.nameDark = `'${shortName}'`
      icon.requireDark = `'../images/icons/${i}'`
    })

  return icons
}

function insertIllustrationAssets(illustrationFiles: Array<string>) {
  return illustrationFiles.reduce<{[key: string]: IconInfo}>((prevIcons, i) => {
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

function updateIconConstants() {
  console.log('Generating icon constants (from the following directories)')
  console.log('\t*' + pngAssetDirPaths.map(({assetDirPath}) => assetDirPath).join('\n\t*'))

  // Build constants for the png assests.
  const icons = pngAssetDirPaths.reduce<{[key: string]: IconInfo}>((prevIcons, {assetDirPath, insertFn}) => {
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

  const iconConstantsdts = `// This file is GENERATED by yarn run update-icon-font. DON'T hand edit
type ReqOut = string | number
type IconMeta = {
  isFont?: boolean
  gridSize?: number
  extension?: string
  charCode?: number
  nameDark?: string
  imagesDir?: string
  require?: ReqOut
  requireDark?: ReqOut
}

// prettier-ignore
export type IconType = ${Object.keys(icons)
    .sort()
    .map(name => `'${name}'`)
    .join(' | ')}

export const iconMeta: {[key in IconType]: IconMeta}
`
  const iconConstants = `// @ts-nocheck
// This file is GENERATED by yarn run update-icon-font. DON'T hand edit
import {isMobile} from '@/constants/platform'

// prettier-ignore
export const iconMeta = {
${Object.keys(icons)
  .sort()
  .map(name => {
    const icon = icons[name]
    if (!icon) throw new Error('impossible')

    let req = ''
    if (icon.require || icon.requireDark) {
      req = `...(isMobile ? {${[
        icon.require ? `get require(): number {return require(${icon.require})}` : '',
        icon.requireDark ? `get requireDark(): number {return require(${icon.requireDark})}` : '',
      ]
        .filter(Boolean)
        .join(', ')}} : {})`
    }

    const meta = [
      icon.charCode ? `charCode: 0x${icon.charCode.toString(16)}` : '',
      icon.extension && icon.extension !== 'png' ? `extension: '${icon.extension}'` : '',
      icon.imagesDir && icon.imagesDir !== "'icons'" ? `imagesDir: ${icon.imagesDir}` : '',
      icon.gridSize ? `gridSize: ${icon.gridSize}` : '',
      icon.isFont ? `isFont: ${icon.isFont}` : '',
      icon.nameDark ? `nameDark: ${icon.nameDark}` : '',
      req ? req : '',
    ]

    return `  '${name}': {${meta.filter(x => x.length).join(', ')}}`
  })
  .join(',\n')}
}
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
${Object.keys(icons).reduce((res, name) => {
  const i = icons[name]
  if (!i) throw new Error('impossible')
  return i.isFont ? res + `.icon-gen-${name}::before {content: "\\${i.charCode?.toString(16)}";}\n` : res
}, '')}
`

  try {
    fs.writeFileSync(paths.iconConstantsdts, iconConstantsdts, 'utf8')
    fs.writeFileSync(paths.iconConstants, iconConstants, 'utf8')
    fs.writeFileSync(paths.iconCss, iconCss, 'utf8')
  } catch (e) {
    console.error(e)
  }
}

export default commands
