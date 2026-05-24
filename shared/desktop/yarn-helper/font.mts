 
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const commands = {
  'update-icon-constants': {
    code: updateIconConstants,
    help: 'Update icon.constants-gen.tsx and icon.css with new/removed files',
  },
  'unused-assets': {
    code: () => unusedAssets(),
    help: 'Find unused assets',
  },
  'delete-unused-assets': {
    code: () => unusedAssets(true),
    help: 'Delete all unused assets and regenerate icon constants',
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

function unusedAssets(deleteFiles = false) {
  const sharedRoot = path.resolve(__dirname, '../..')

  // Generated/tool files that reference assets by definition — exclude from search
  const excludedFromSearch = [
    'common-adapters/icon.constants-gen.shared.tsx',
    'common-adapters/icon.constants-gen.d.ts',
    'common-adapters/icon.css',
    'desktop/yarn-helper/font.mts',
  ].map(f => path.resolve(sharedRoot, f))

  // Collect candidate asset dirs: {dir, files[], nameExtractor}
  type AssetDir = {dir: string; files: Array<string>; nameOf: (filename: string) => string | undefined}

  const imageDirs: Array<AssetDir> = [
    {
      dir: paths.iconPng,
      files: fs.readdirSync(paths.iconPng),
      // strip @2x/@3x suffix and extension → the icon name used in code
      nameOf: f => {
        const parsed = path.parse(f)
        if (!['.jpg', '.png'].includes(parsed.ext)) return undefined
        return parsed.name.replace(/@[23]x$/, '')
      },
    },
    {
      dir: paths.illustrationPng,
      files: fs.readdirSync(paths.illustrationPng),
      nameOf: f => {
        const parsed = path.parse(f)
        if (!['.jpg', '.png'].includes(parsed.ext)) return undefined
        return parsed.name.replace(/@[23]x$/, '')
      },
    },
    {
      dir: path.resolve(__dirname, '../../images/iconfont'),
      files: fs.readdirSync(path.resolve(__dirname, '../../images/iconfont')),
      // e.g. "1-kb-iconfont-add-16.svg" → "iconfont-add"
      nameOf: f => {
        const m = f.match(/^\d+-kb-(iconfont-.*)-\d+\.svg$/)
        return m ? m[1] : undefined
      },
    },
  ]

  // Collect all TS/TSX source files to grep (excluding generated files and node_modules)
  const sourceFiles = execSync(
    `find "${sharedRoot}" -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -path "*/node_modules/*"`,
    {encoding: 'utf8'}
  )
    .trim()
    .split('\n')
    .filter(f => !excludedFromSearch.includes(f))

  // Write source file list to a temp file so xargs can read it without hitting ARG_MAX
  const tmpList = '/tmp/asset-check-sources.txt'
  fs.writeFileSync(tmpList, sourceFiles.join('\n') + '\n')

  // First pass: find which names are referenced in source.
  // Also check prefixes to catch dynamically-constructed icon names like:
  //   `icon-phone-revoke-background-${n}-${size}`
  // A prefix match on "icon-phone-revoke-background-" is enough to flag the whole family.
  const usedNames = new Set<string>()
  for (const {files, nameOf} of imageDirs) {
    const seen = new Set<string>()
    for (const f of files) {
      const name = nameOf(f)
      if (!name || seen.has(name)) continue
      seen.add(name)

      // Check the full name first, then progressively shorter prefixes to catch
      // dynamically-constructed names like `icon-phone-revoke-background-${n}-${size}`
      let found = false
      const segments = name.split('-')
      for (let keep = segments.length; keep >= 2 && !found; keep--) {
        const candidate = segments.slice(0, keep).join('-') + (keep < segments.length ? '-' : '')
        try {
          execSync(`xargs grep -ql "${candidate}" < "${tmpList}"`, {encoding: 'utf8'})
          found = true
        } catch { /* not found */ }
      }

      if (found) usedNames.add(name)
    }
  }

  // Light/dark icons are paired: if either half is used, both must be kept.
  // Propagate usage across the pair before deciding what's unused.
  for (const name of [...usedNames]) {
    const darkSibling = name.startsWith('icon-dark-') ? name.replace('icon-dark-', 'icon-') : name.replace(/^icon-/, 'icon-dark-')
    usedNames.add(darkSibling)
  }

  const unused: Array<{name: string; files: Array<string>}> = []
  for (const {files, nameOf} of imageDirs) {
    const seen = new Set<string>()
    for (const f of files) {
      const name = nameOf(f)
      if (!name || seen.has(name)) continue
      seen.add(name)
      if (!usedNames.has(name)) {
        unused.push({name, files: files.filter(file => nameOf(file) === name)})
      }
    }
  }

  if (unused.length === 0) {
    console.log('No unused assets found.')
    return
  }

  if (!deleteFiles) {
    console.log(`Found ${unused.length} unused asset(s):\n`)
    for (const {name, files} of unused) {
      console.log(`  ${name}`)
      for (const f of files) console.log(`    ${f}`)
    }
    return
  }

  // Delete mode: remove each file and its siblings
  let deleted = 0
  for (const {dir, files, nameOf} of imageDirs) {
    for (const f of files) {
      const name = nameOf(f)
      if (!name) continue
      if (unused.some(u => u.name === name)) {
        fs.rmSync(path.join(dir, f))
        deleted++
      }
    }
  }
  console.log(`Deleted ${deleted} file(s) across ${unused.length} unused asset(s).`)
  updateIconConstants()
}

export default commands
