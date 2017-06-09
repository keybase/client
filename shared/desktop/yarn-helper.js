// @flow
// Helper for cross platform yarn run script commands
import path from 'path'
import childProcess, {execSync} from 'child_process'
import fs from 'fs'

const [, , command, ...rest] = process.argv

const inject = info => {
  let temp = {
    ...info,
    env: {
      ...process.env,
      ...info.env,
    },
  }

  if (info.nodeEnv) {
    temp.env.NODE_ENV = info.nodeEnv
  }

  if (rest.length && temp.shell) {
    temp.shell = temp.shell + ' ' + rest.join(' ')
  }

  return temp
}

function pad(s, num) {
  while (s.length < num) {
    s += ' '
  }

  return s
}

const nodeCmd = 'babel-node --presets es2015,stage-2 --plugins transform-flow-strip-types'
const webpackLog = null // '~/webpack-log.txt'
const webpackCmd = `webpack --config ./desktop/webpack.config.babel.js --progress --profile --colors ${webpackLog ? `--json > ${webpackLog}` : ''}`

const commands = {
  'apply-new-fonts': {
    code: applyNewFonts,
    help: 'Copy font output into the right folders',
  },
  'build-dev': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    nodeEnv: 'development',
    shell: webpackCmd,
  },
  'hot-server': {
    env: {BABEL_ENV: 'yarn', HOT: 'true'},
    help: 'Start the webpack hot reloading code server (needed by yarn run start-hot)',
    nodeEnv: 'development',
    shell: `BEFORE_HOT=true yarn run _helper build-dev && BEFORE_HOT=false ${process.env['NO_DASHBOARD'] ? '' : 'webpack-dashboard --'} webpack-dev-server --config=./desktop/webpack.config.babel.js`,
  },
  'build-prod': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a production build of the js code',
    nodeEnv: 'production',
    shell: webpackCmd,
  },
  'generate-font-project': {
    code: generateIcoMoon,
    help: 'Generate the icomoon project file',
  },
  help: {
    code: () => {
      const len = Object.keys(commands).reduce((acc, i) => Math.max(i.length, acc), 1) + 2
      console.log(
        Object.keys(commands)
          .map(c => commands[c].help && `yarn run ${pad(c + ': ', len)}${commands[c].help || ''}`)
          .filter(c => !!c)
          .join('\n')
      )
    },
  },
  'inject-code-prod': {
    help: 'Copy current code into currently installed Keybase app',
    shell: 'yarn run package; cp dist/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist/',
  },
  'hot-server-dumb': {
    env: {HOT: 'true', USING_DLL: 'true', DUMB: 'true', BABEL_ENV: 'yarn'},
    nodeEnv: 'development',
    nodePathDesktop: true,
    shell: process.env['NO_DASHBOARD']
      ? `${nodeCmd} desktop/server.js`
      : `webpack-dashboard -- ${nodeCmd} desktop/server.js`,
    help: 'Start the webpack hot reloading code server (needed by npm run start-hot)',
  },
  'inject-sourcemaps-prod': {
    help: '[Path to sourcemaps]: Copy sourcemaps into currently installed Keybase app',
    shell: "a(){ cp '$1'/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist; };a",
  },
  'local-visdiff': {
    env: {
      KEYBASE_JS_VENDOR_DIR: process.env['KEYBASE_JS_VENDOR_DIR'] || path.resolve('../../js-vendor-desktop'),
      VISDIFF_DRY_RUN: 1,
    },
    help: 'Perform a local visdiff',
    shell: 'cd ../visdiff && yarn install --pure-lockfile && cd ../shared && node ../visdiff/dist/index.js',
  },
  package: {
    env: {BABEL_ENV: 'yarn', NO_SOURCE_MAPS: 'true'},
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `${nodeCmd} desktop/package.js`,
  },
  postinstall: {
    code: postInstall,
    help: 'all: install global eslint. dummy modules',
  },
  'render-screenshots': {
    env: {
      BABEL_ENV: 'yarn',
      ELECTRON_ENABLE_LOGGING: 1,
      KEYBASE_NO_ENGINE: 1,
      VISDIFF: 'true',
    },
    help: 'Render images of dumb components',
    shell: 'yarn run _helper build-dev && electron ./desktop/dist/render-visdiff.bundle.js',
  },
  'setup-debug-main': {
    code: setupDebugMain,
    help: 'Setup node-inspector to work with electron (run once per electron prebuilt upgrade)',
  },
  start: {
    help: 'Do a simple dev build',
    shell: 'yarn run build-dev && yarn run start-cold',
  },
  'start-cold': {
    help: 'Start electron with no hot reloading',
    nodeEnv: 'development',
    shell: 'electron ./desktop/dist/main.bundle.js',
  },
  'start-hot': {
    env: {BABEL_ENV: 'yarn', HOT: 'true'},
    help: 'Start electron with hot reloading (needs yarn run hot-server)',
    nodeEnv: 'development',
    shell: `${nodeCmd} desktop/client.js`,
  },
  'start-prod': {
    help: 'Launch installed Keybase app with console output',
    shell: '/Applications/Keybase.app/Contents/MacOS/Electron',
  },
  'updated-fonts': {
    code: updatedFonts,
    help: 'Update our font sizes automatically',
  },
}

function postInstall() {
  // Inject dummy module
  exec('node make-shim net')
  exec('node make-shim tls')
  exec('node make-shim msgpack')
}

function setupDebugMain() {
  let electronVer = null
  try {
    // $FlowIssue we catch this error
    electronVer = childProcess
      .execSync('yarn list --dev electron', {encoding: 'utf8'})
      .match(/electron@([0-9.]+)/)[1]
    console.log(`Found electron version: ${electronVer}`)
  } catch (err) {
    console.log("Couldn't figure out electron")
    process.exit(1)
  }

  exec('yarn install node-inspector')
  exec('yarn install git+https://git@github.com/enlight/node-pre-gyp.git#detect-electron-runtime-in-find')
  exec(
    `node_modules/.bin/node-pre-gyp --target=${electronVer || ''} --runtime=electron --fallback-to-build --directory node_modules/v8-debug/ --dist-url=https://atom.io/download/atom-shell reinstall`
  )
  exec(
    `node_modules/.bin/node-pre-gyp --target=${electronVer || ''} --runtime=electron --fallback-to-build --directory node_modules/v8-profiler/ --dist-url=https://atom.io/download/atom-shell reinstall`
  )
}

function svgToGridMap() {
  const grids = {}

  fs.readdirSync('../shared/images/iconfont').forEach(i => {
    const match = i.match(/^kb-iconfont-(.*)-(\d+).svg$/)
    if (match && match.length === 3) {
      const name = match[1]
      const p = path.resolve('../shared/images/iconfont', i)
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
    fs.readFileSync(path.join(__dirname, '../images/iconfont/kb-icomoon-project-app.json'), 'utf8')
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
    path.join(__dirname, '../images/iconfont/kb-icomoon-project-generated.json'),
    JSON.stringify(write, null, 4),
    'utf8'
  )
  console.log('kb-icomoon-project-generated.json is ready for icomoon')
  updatedFonts()
}

function applyNewFonts() {
  console.log('Moving font to project')
  fs.writeFileSync(
    path.join(__dirname, '../fonts/kb.ttf'),
    fs.readFileSync(path.join(__dirname, '../images/iconfont/kb/fonts/kb.ttf'))
  )
}

function updatedFonts() {
  console.log('Updating generated code')

  const icons = {}

  fs
    .readdirSync(path.join(__dirname, '../images/icons'))
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

      return `  '${name}': {
    ${meta.join('\n    ')}
  },`
    })
    .join('\n')}/* eslint-enable */

}

export type IconType = $Keys<typeof iconMeta_>
export const iconMeta: {[key: IconType]: IconMeta} = iconMeta_
`

  fs.writeFileSync(path.join(__dirname, '../common-adapters/icon.constants.js'), iconConstants, 'utf8')
}

function exec(command, env, options) {
  if (!env) {
    env = process.env
  }

  console.log(execSync(command, {env: env, stdio: 'inherit', encoding: 'utf8', ...options}))
}

let info = commands[command]

if (!info) {
  console.log('Unknown command: ', command)
  process.exit(1)
}

info = inject(info)

if (info.shell) {
  exec(info.shell, info.env, info.options)
}

if (info.code) {
  info.code()
}
