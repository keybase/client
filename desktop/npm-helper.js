// @flow
// Helper for cross platform npm run script commands
import path from 'path'
import childProcess, {execSync} from 'child_process'
import fs from 'fs'
import deepdiff from 'deep-diff'

const [,, command, ...rest] = process.argv

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

  if (info.nodePathDesktop) {
    temp.env.NODE_PATH = path.join(process.cwd(), 'node_modules')
  }

  if (rest.length && temp.shell) {
    temp.shell = temp.shell + ' ' + rest.join(' ')
  }

  return temp
}

function pad (s, num) {
  while (s.length < num) {
    s += ' '
  }

  return s
}

const nodeCmd = 'babel-node --presets es2015,stage-2 --plugins transform-flow-strip-types'

const commands = {
  'help': {
    code: () => {
      const len = Object.keys(commands).reduce((acc, i) => Math.max(i.length, acc), 1) + 2
      console.log(Object.keys(commands).map(c => commands[c].help && `npm run ${pad(c + ': ', len)}${commands[c].help || ''}`).filter(c => !!c).join('\n'))
    },
  },
  'start': {
    shell: 'npm run build-dev && npm run start-cold', help: 'Do a simple dev build',
  },
  'start-hot': {
    env: {HOT: 'true'},
    nodeEnv: 'development',
    shell: `${nodeCmd} client.js`,
    help: 'Start electron with hot reloading (needs npm run hot-server)',
  },
  'start-hot-debug': {
    env: {HOT: 'true', USE_INSPECTOR: 'true'},
    nodeEnv: 'development',
    shell: `${nodeCmd} client.js`,
    help: 'Start electron with hot reloading against a debugged main process',
  },
  'debug-main': {
    env: {ELECTRON_RUN_AS_NODE: 'true'},
    nodeEnv: 'development',
    shell: './node_modules/.bin/electron node_modules/node-inspector/bin/inspector.js --no-preload',
    help: 'Debug the main process with node-inspector',
  },
  'setup-debug-main': {
    help: 'Setup node-inspector to work with electron (run once per electron prebuilt upgrade)',
    code: setupDebugMain,
  },
  'start-cold': {
    nodeEnv: 'development',
    shell: 'electron ./dist/main.bundle.js',
    help: 'Start electron with no hot reloading',
  },
  'build-dev': {
    env: {NO_SERVER: 'true'},
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: `${nodeCmd} server.js`,
    help: 'Make a development build of the js code',
  },
  'build-prod': {
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.production.js --progress --profile --colors',
    help: 'Make a production build of the js code',
  },
  'build-main-thread': {
    env: {HOT: 'true'},
    nodeEnv: 'development',
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.main-thread-only.js --progress --profile --colors',
    help: 'Bundle the code that the main node thread uses',
  },
  'build-wpdll': {
    nodeEnv: 'development',
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.dll-build.js --progress',
    help: 'Make a production build of the js code',
  },
  'build-profile': {
    nodeEnv: 'development',
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.development.js --progress --profile --json > /tmp/stats.json',
    help: 'Make a production build of the js code',
  },
  'package': {
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: `${nodeCmd} package.js`,
    help: 'Package up the production js code',
  },
  'hot-server': {
    env: {HOT: 'true', USING_DLL: 'true'},
    nodeEnv: 'development',
    nodePathDesktop: true,
    shell: process.env['NO_DASHBOARD'] ? `${nodeCmd} server.js` : `webpack-dashboard -- ${nodeCmd} server.js`,
    help: 'Start the webpack hot reloading code server (needed by npm run start-hot)',
  },
  'inject-sourcemaps-prod': {
    shell: 'a(){ cp \'$1\'/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist; };a',
    help: '[Path to sourcemaps]: Copy sourcemaps into currently installed Keybase app',
  },
  'inject-code-prod': {
    shell: 'npm run package; cp dist/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist/',
    help: 'Copy current code into currently installed Keybase app',
  },
  'start-prod': {
    shell: '/Applications/Keybase.app/Contents/MacOS/Electron',
    help: 'Launch installed Keybase app with console output',
  },
  'postinstall': {
    help: 'Window: fixup symlinks, all: install global eslint. dummy msgpack',
    code: postInstall,
  },
  'render-screenshots': {
    env: {
      KEYBASE_NO_ENGINE: 1,
      ELECTRON_ENABLE_LOGGING: 1,
    },
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.visdiff.js && electron ./dist/render-visdiff.bundle.js',
    help: 'Render images of dumb components',
  },
  'local-visdiff': {
    env: {
      VISDIFF_DRY_RUN: 1,
      KEYBASE_JS_VENDOR_DIR: process.env['KEYBASE_JS_VENDOR_DIR'] || path.resolve('../../js-vendor-desktop'),
    },
    nodePathDesktop: true,
    shell: 'npm install ../visdiff && keybase-visdiff',
    help: 'Perform a local visdiff',
  },
  'updated-fonts': {
    help: 'Update our font sizes automatically',
    code: updatedFonts,
  },
  'undiff-log': {
    help: 'Undiff log send',
    code: undiff,
  },
  'generate-font-project': {
    help: 'Generate the icomoon project file',
    code: generateIcoMoon,
  },
  'apply-new-fonts': {
    help: 'Copy font output into the right folders',
    code: applyNewFonts,
  },
}

function postInstall () {
  if (process.platform === 'win32') {
    fixupSymlinks()
  }

  // Inject dummy module
  if (process.platform === 'win32') {
    exec('if not exist node_modules\\msgpack mkdir node_modules\\msgpack')
    exec('echo module.exports = null > node_modules\\msgpack\\index.js')
    exec('echo {"main": "index.js"} > node_modules\\msgpack\\package.json')
  } else {
    exec("mkdir -p node_modules/msgpack; echo 'module.exports = null' > node_modules/msgpack/index.js; echo '{\"main\": \"index.js\"}' > node_modules/msgpack/package.json")
  }
}

function setupDebugMain () {
  let electronVer = null
  try {
    // $FlowIssue we catch this error
    electronVer = childProcess.execSync('npm list --dev electron', {encoding: 'utf8'}).match(/electron@([0-9.]+)/)[1]
    console.log(`Found electron version: ${electronVer}`)
  } catch (err) {
    console.log("Couldn't figure out electron")
    process.exit(1)
  }

  exec('npm install node-inspector')
  exec('npm install git+https://git@github.com/enlight/node-pre-gyp.git#detect-electron-runtime-in-find')
  exec(`node_modules/.bin/node-pre-gyp --target=${electronVer || ''} --runtime=electron --fallback-to-build --directory node_modules/v8-debug/ --dist-url=https://atom.io/download/atom-shell reinstall`)
  exec(`node_modules/.bin/node-pre-gyp --target=${electronVer || ''} --runtime=electron --fallback-to-build --directory node_modules/v8-profiler/ --dist-url=https://atom.io/download/atom-shell reinstall`)
}

function fixupSymlinks () {
  const symlinks = [
    {srcNode: './shared', srcShell: 'shared', dstShell: '..\\shared'},
    {srcNode: './renderer/fonts', srcShell: 'renderer\\fonts', dstShell: '..\\shared\\fonts'},
  ]

  symlinks.forEach(symlink => {
    let s = fs.lstatSync(symlink.srcNode)
    if (!s.isSymbolicLink()) {
      console.log(`Fixing up shared ${symlink.srcNode}`)

      try {
        exec(`del ${symlink.srcShell}`, null, {cwd: path.join(process.cwd(), '.')})
      } catch (_) { }
      try {
        exec(`mklink /j ${symlink.srcShell} ${symlink.dstShell}`, null, {cwd: path.join(process.cwd(), '.')})
      } catch (_) { }
    }
  })
}

// Edit this function to filter down the store in the undiff log
function storeFilter (store: any) {
  // Example
  // try {
    // return {mike: store.tracker.trackers.mike}
  // } catch (_) {
    // return {nullStore: null}
  // }

  return store
}

// Edit this function to filter down actions, return null to filter out entirely
function actionFilter (action: any) {
  // Example
  // if (action.type.startsWith('gregor')) {
    // return null
  // }

  return action
}

// Recreate the store from a log that has diffs (from log send)
function undiff () {
  let log
  try {
    console.log('Analyzing ./log.txt')
    log = fs.readFileSync('./log.txt', 'utf8')
  } catch (e) {
    console.log('Undiff needs ./log.txt to analyze', e)
    return
  }
  let store = {}

  const lineFilter = line => line.startsWith('From Keybase: ') && line.match(/ Diff: /) || line.match(/ Dispatching action: /)
  const lineToActionOrDiff = line => {
    const diff = line.match(/ Diff: {2}(.*)/)
    if (diff) {
      const parsed = JSON.parse(diff[1])
      if (parsed) {
        return {diff: parsed}
      }
    } else {
      const action = line.match(/ Dispatching action: (.*): {2}(\{.*\})/)
      if (action) {
        return {action: JSON.parse(action[2])}
      }
    }
    return null
  }

  const buildStore = part => {
    if (part && part.hasOwnProperty('action')) {
      return part
    }

    part && part.diff && part.diff.forEach(diff => {
      try {
        deepdiff.applyChange(store, store, diff)
      } catch (err) {
        console.log(`Tried to apply change: ${diff} but failed, trying to continue. ${err}`)
      }
    })
    return store
  }

  const filterStore = part => {
    if (part && part.hasOwnProperty('action')) {
      return part
    }

    return storeFilter(part)
  }

  const filterActions = part => {
    if (part && part.hasOwnProperty('action')) {
      // $FlowIssue
      const action = actionFilter(part.action)
      if (action) return {action}
      return null
    }

    return part
  }

  const parts = log
    .split('\n')
    .filter(lineFilter)
    .map(lineToActionOrDiff)
    .filter(part => part)
    .map(buildStore)
    .map(filterStore)
    .map(filterActions)
    .filter(part => part)

  fs.writeFileSync('./log.json', JSON.stringify(parts, null, 2))
  console.log('Success! Wrote ./log.json')
}

function svgToGridMap () {
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

      grids[gridSize][name] = {name, gridSize, path: p}
    }
  })

  return grids
}
function generateIcoMoon () {
  const svgPaths = {}
  // Need to get the svg info from iconmoon. Couldn't figure out how to derive exactly what they need from the files themselves
  JSON.parse(fs.readFileSync('../shared/images/iconfont/kb-icomoon-project-app.json', 'utf8')).icons.forEach(icon => {
    svgPaths[icon.tags[0]] = icon.paths
  })

  const grids = svgToGridMap()

  let selectionOrder = 1
  let selectionID = 1

  const iconSets = Object.keys(grids).map((size, idx) => ({
    id: idx,
    metadata: {
      name: `Grid ${size}`,
    },
    selection: Object.keys(grids[size]).map((name, idx) => ({
      order: selectionOrder++,
      id: selectionID++,
      prevSize: size,
      name,
    })),
    icons: Object.keys(grids[size]).map((name, idx) => {
      const paths = svgPaths[`kb-iconfont-${name}-${size}`]
      if (!paths) {
        throw new Error(`Can't find path for ${name}. Did you run the svgs through icomoon and update kb-icomoon-project-app.json?`)
      }
      return {
        id: idx,
        paths,
        attrs: [],
        isMulticolor: false,
        grid: size,
        selection: [],
        tags: [name],
      }
    }),
    height: 1024,
    prevSize: 12,
    colorThemes: [],
  }))

  const write = {
    metadata: {
      name: 'KB icon fonts',
      lastOpened: 1478124176910,
      created: 1478124107835,
    },
    iconSets,
    preferences: {
      showGlyphs: true,
      showCodes: false,
      showQuickUse: true,
      showQuickUse2: true,
      showSVGs: true,
      fontPref: {
        prefix: 'icon-kb-iconfont-',
        metadata: {
          fontFamily: 'kb',
          majorVersion: 1,
          minorVersion: 0,
        },
        metrics: {
          emSize: 1024,
          baseline: 6.25,
          whitespace: 50,
        },
        embed: false,
        noie8: true,
        ie7: false,
        showSelector: true,
        showMetadata: true,
        showMetrics: true,
      },
      imagePref: {
        prefix: 'icon-',
        png: false,
        useClassSelector: false,
        color: 0,
        bgColor: 16777215,
        classSelector: '.icon',
        height: 32,
        columns: 16,
        margin: 16,
      },
      historySize: 100,
      gridSize: 16,
      showGrid: true,
      showLiga: false,
    },
    uid: -1,
  }

  fs.writeFileSync('./shared/images/iconfont/kb-icomoon-project-generated.json', JSON.stringify(write, null, 4), 'utf8')
  console.log('kb-icomoon-project-generated.json is ready for icomoon')
  updatedFonts()
}

function applyNewFonts () {
  console.log('Moving font to project')
  fs.writeFileSync('./shared/fonts/kb.ttf', fs.readFileSync('./shared/images/iconfont/kb/fonts/kb.ttf'))
}

function updatedFonts () {
  console.log('Updating generated code')

  const icons = {}

  fs.readdirSync('../shared/images/icons')
    .filter(i => i.indexOf('@') === -1 && i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        isFont: false,
        extension: i.slice(-3),
        require: `'../images/icons/${i}'`,
      }
    })

  const grids = svgToGridMap()
  let charCode = 0xe900

  Object.keys(grids).forEach(gridSize => {
    Object.keys(grids[gridSize]).forEach(name => {
      const info = grids[gridSize][name]
      icons[`iconfont-${info.name}`] = {
        isFont: true,
        gridSize: info.gridSize,
        charCode,
      }
      charCode++
    })
  })

  const iconConstants = `// @flow
// This file is GENERATED by npm run updated-fonts. DON'T hand edit

type IconMeta = {
  isFont: boolean,
  gridSize?: number,
  extension?: string,
  charCode?: number,
  require?: any,
}

const iconMeta_ = {
${
  // eslint really doesn't understand embedded backticks
/* eslint-disable */
Object.keys(icons).map(name => {
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
  }).join('\n')
/* eslint-enable */
  }
}

export type IconType = $Keys<typeof iconMeta_>
export const iconMeta: {[key: IconType]: IconMeta} = iconMeta_
`

  fs.writeFileSync('./shared/common-adapters/icon.constants.js', iconConstants, 'utf8')
}

function exec (command, env, options) {
  if (!env) {
    env = process.env
  }

  // $FlowIssue
  console.log(execSync(command, {env: env, stdio: 'inherit', encoding: 'utf8', ...options}))
}

let info = commands[command]

if (!info) {
  console.log('Unknown command: ', command)
  process.exit(1)
}

info = inject(info)

if (info.shell) {
  exec(info.shell, info.env)
}

if (info.code) {
  info.code()
}
