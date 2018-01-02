// @flow
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import prettier from 'prettier'

const commands = {
  'apply-new-fonts': {
    code: applyNewFonts,
    help: 'Copy font output into the right folders',
  },
  'generate-font-project': {
    code: generateIcoMoon,
    help: 'Generate the icomoon project file',
  },
  'updated-fonts': {
    code: updatedFonts,
    help: 'Update our font sizes automatically',
  },
  'unused-assets': {
    code: unusedAssetes,
    help: 'Find unused assets',
  },
}

function unusedAssetes() {
  const allFiles = fs.readdirSync(path.join(__dirname, '../../images/icons'))

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

function svgToGridMap() {
  const grids = {}

  fs.readdirSync(path.resolve(__dirname, '../../images/iconfont')).forEach(i => {
    const match = i.match(/^kb-iconfont-(.*)-(\d+).svg$/)
    if (match && match.length === 3) {
      const name = match[1]
      const p = path.resolve(path.resolve(__dirname, '../../images/iconfont'), i)
      const gridSize = match[2]

      if (!grids[gridSize]) {
        grids[gridSize] = {}
      }

      grids[gridSize][name] = {gridSize, name, path: p}
    }
  })

  return grids
}
function generateIcoMoon() {
  const svgPaths = {}
  // Need to get the svg info from iconmoon. Couldn't figure out how to derive exactly what they need from the files themselves
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../images/iconfont/kb-icomoon-project-app.json'), 'utf8')
  ).icons.forEach(icon => {
    svgPaths[icon.tags[0]] = icon.paths
  })

  const grids = svgToGridMap()

  let selectionOrder = 1
  let selectionID = 1

  const iconSets = Object.keys(grids).map((size, idx) => ({
    colorThemes: [],
    height: 1024,
    icons: Object.keys(grids[size]).map((name, idx) => {
      const paths = svgPaths[`kb-iconfont-${name}-${size}`]
      if (!paths) {
        throw new Error(
          `Can't find path for ${name}. Did you run the svgs through icomoon and update kb-icomoon-project-app.json?`
        )
      }
      return {
        attrs: [],
        grid: size,
        id: idx,
        isMulticolor: false,
        paths,
        selection: [],
        tags: [name],
      }
    }),
    id: idx,
    metadata: {
      name: `Grid ${size}`,
    },
    prevSize: 12,
    selection: Object.keys(grids[size]).map((name, idx) => ({
      id: selectionID++,
      name,
      order: selectionOrder++,
      prevSize: size,
    })),
  }))

  const write = {
    iconSets,
    metadata: {
      created: 1478124107835,
      lastOpened: 1478124176910,
      name: 'KB icon fonts',
    },
    preferences: {
      fontPref: {
        embed: false,
        ie7: false,
        metadata: {
          fontFamily: 'kb',
          majorVersion: 1,
          minorVersion: 0,
        },
        metrics: {
          baseline: 6.25,
          emSize: 1024,
          whitespace: 50,
        },
        noie8: true,
        prefix: 'icon-kb-iconfont-',
        showMetadata: true,
        showMetrics: true,
        showSelector: true,
      },
      gridSize: 16,
      historySize: 100,
      imagePref: {
        bgColor: 16777215,
        classSelector: '.icon',
        color: 0,
        columns: 16,
        height: 32,
        margin: 16,
        png: false,
        prefix: 'icon-',
        useClassSelector: false,
      },
      showCodes: false,
      showGlyphs: true,
      showGrid: true,
      showLiga: false,
      showQuickUse: true,
      showQuickUse2: true,
      showSVGs: true,
    },
    uid: -1,
  }

  fs.writeFileSync(
    path.join(__dirname, '../../images/iconfont/kb-icomoon-project-generated.json'),
    JSON.stringify(write, null, 4),
    'utf8'
  )
  console.log('kb-icomoon-project-generated.json is ready for icomoon')
  updatedFonts()
}

function applyNewFonts() {
  console.log('Moving font to project')
  fs.writeFileSync(
    path.join(__dirname, '../../fonts/kb.ttf'),
    fs.readFileSync(path.join(__dirname, '../../images/iconfont/kb/fonts/kb.ttf'))
  )
}

function updatedFonts() {
  console.log('Updating generated code')

  const icons = {}

  fs
    .readdirSync(path.join(__dirname, '../../images/icons'))
    .filter(i => i.indexOf('@') === -1 && i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        extension: i.slice(-3),
        isFont: false,
        require: `'../images/icons/${i}'`,
      }
    })

  const grids = svgToGridMap()
  let charCode = 0xe900

  Object.keys(grids).forEach(gridSize => {
    Object.keys(grids[gridSize]).forEach(name => {
      const info = grids[gridSize][name]
      icons[`iconfont-${info.name}`] = {
        charCode,
        gridSize: info.gridSize,
        isFont: true,
      }
      charCode++
    })
  })

  const iconConstants = `// @flow
// This file is GENERATED by yarn run updated-fonts. DON'T hand edit
/* eslint-disable prettier/prettier */

type IconMeta = {
  isFont: boolean,
  gridSize?: number,
  extension?: string,
  charCode?: number,
  require?: any,
}

const iconMeta_ = {
${/* eslint-disable */
  Object.keys(icons)
    .map(name => {
      const icon = icons[name]
      const meta = [`isFont: ${icon.isFont},`]
      if (icon.gridSize) {
        meta.push(`gridSize: ${icons[name].gridSize},`)
      }
      if (icon.extension) {
        meta.push(`extension: '${icons[name].extension}',`)
      }
      if (icon.charCode) {
        meta.push(`charCode: 0x${icons[name].charCode.toString(16)},`)
      }
      if (icon.require) {
        meta.push(`require: require(${icons[name].require}),`)
      }

      return `'${name}': {
    ${meta.join('\n')}
  },`
    })
    .join('\n')}/* eslint-enable */
}

export type IconType = $Keys<typeof iconMeta_>
export const iconMeta: {[key: IconType]: IconMeta} = iconMeta_
`

  const filename = path.join(__dirname, '../../common-adapters/icon.constants.js')
  fs.writeFileSync(filename, prettier.format(iconConstants, prettier.resolveConfig.sync(filename)), 'utf8')
}

export default commands
