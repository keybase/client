// Helper for cross platform npm run script commands
import path from 'path'
import child_process, {execSync} from 'child_process'
import fs from 'fs'

const postinstallGlobals = {
  'eslint/eslint': '#798ac54518ff161e5ff3394fc62c55200d7e6f64', // need fix for https://github.com/eslint/eslint/issues/5261, can go mainline soon
  'eslint-config-standard': '@5.1.0',
  'eslint-config-standard-react': '@2.3.0',
  'eslint-plugin-mocha': '@2.0.0',
  'eslint-plugin-babel': '@3.1.0',
  'eslint-plugin-filenames': '@0.2.0',
  'eslint-plugin-react': '@3.16.1',
  'eslint-plugin-standard': '@1.3.2',
  'eslint-plugin-promise': '@1.0.8',
  'eslint-config-standard-jsx': '@1.1.1',
  'babel-eslint': '@5.0.0',
  'marudor/eslint-plugin-flow-vars': '#eslint-2.0' // this is a PR that makes it compat w/ eslint 2.*
}

const [,, command, ...rest] = process.argv

const inject = info => {
  let temp = {
    ...info,
    env: {
      ...process.env,
      ...info.env
    }
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

const commands = {
  'help': {
    code: () => {
      const len = Object.keys(commands).reduce((acc, i) => Math.max(i.length, acc), 1) + 2
      console.log(Object.keys(commands).map(c => commands[c].help && `npm run ${pad(c + ': ', len)}${commands[c].help}`).filter(c => !!c).join('\n'))
    }
  },
  'start': {
    shell: 'npm run build-dev && npm run start-cold', help: 'Do a simple dev build'
  },
  'start-hot': {
    env: {HOT: 'true'},
    nodeEnv: 'development',
    shell: 'node client.js',
    help: 'Start electron with hot reloading (needs npm run hot-server)'
  },
  'start-hot-debug': {
    env: {HOT: 'true', USE_INSPECTOR: 'true'},
    nodeEnv: 'development',
    shell: 'node client.js',
    help: 'Start electron with hot reloading against a debugged main process'
  },
  'debug-main': {
    env: {ELECTRON_RUN_AS_NODE: 'true'},
    nodeEnv: 'development',
    shell: './node_modules/.bin/electron node_modules/node-inspector/bin/inspector.js --no-preload',
    help: 'Debug the main process with node-inspector'
  },
  'setup-debug-main': {
    help: 'Setup node-inspector to work with electron (run once per electron prebuilt upgrade)',
    code: setupDebugMain
  },
  'start-cold': {
    nodeEnv: 'development',
    shell: 'electron ./dist/main.bundle.js',
    help: 'Start electron with no hot reloading'
  },
  'build-dev': {
    env: {NO_SERVER: 'true', DEBUG: 'express:*'},
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: 'node server.js',
    help: 'Make a development build of the js code'
  },
  'watch-test-file': {
    env: {WATCH: 'true'},
    nodeEnv: 'staging',
    nodePathDesktop: true,
    shell: 'node test.js',
    help: 'test code'
  },
  'test': {
    env: {},
    nodeEnv: 'staging',
    nodePathDesktop: true,
    shell: 'node test.js',
    help: 'test code'
  },
  'build-prod': {
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: 'webpack --config webpack.config.production.js --progress --profile --colors',
    help: 'Make a production build of the js code'
  },
  'package': {
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: 'node package.js',
    help: 'Package up the production js code'
  },
  'hot-server': {
    env: {HOT: 'true', DEBUG: 'express:*'},
    nodeEnv: 'production',
    nodePathDesktop: true,
    shell: 'node server.js',
    help: 'Start the webpack hot reloading code server (needed by npm run start-hot)'
  },
  'inject-sourcemaps-prod': {
    shell: 'a(){ cp \'$1\'/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist; };a',
    help: '[Path to sourcemaps]: Copy sourcemaps into currently installed Keybase app'
  },
  'inject-code-prod': {
    shell: 'npm run package; cp dist/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist/',
    help: 'Copy current code into currently installed Keybase app'
  },
  'start-prod': {
    shell: '/Applications/Keybase.app/Contents/MacOS/Electron',
    help: 'Launch installed Keybase app with console output'
  },
  'electron-rebuild': {
    shell: './node_modules/.bin/electron-rebuild',
    help: 'Rebuild electron native code'
  },
  'postinstall': {
    help: 'Window: fixup symlinks, all: install global eslint',
    code: postInstall
  }
}

function postInstall () {
  if (process.platform === 'win32') {
    fixupSymlinks()
  }

  if (!process.env.KEYBASE_SKIP_DEV_TOOLS) {
    const modules = Object.keys(postinstallGlobals).map(k => `${k}${postinstallGlobals[k]}`).join(' ')
    exec(`npm install -g ${modules}`)
  }
}

function setupDebugMain () {
  let electronVer = null
  try {
    electronVer = child_process.execSync('npm list --dev electron-prebuilt', {encoding: 'utf8'}).match(/electron-prebuilt@([0-9.]+)/)[1]
    console.log(`Found electron-prebuilt version: ${electronVer}`)
  } catch (err) {
    console.log("Couldn't figure out electron")
    process.exit(1)
  }

  exec('npm install node-inspector')
  exec('npm install git+https://git@github.com/enlight/node-pre-gyp.git#detect-electron-runtime-in-find')
  exec(`node_modules/.bin/node-pre-gyp --target=${electronVer} --runtime=electron --fallback-to-build --directory node_modules/v8-debug/ --dist-url=https://atom.io/download/atom-shell reinstall`)
  exec(`node_modules/.bin/node-pre-gyp --target=${electronVer} --runtime=electron --fallback-to-build --directory node_modules/v8-profiler/ --dist-url=https://atom.io/download/atom-shell reinstall`)
}

function fixupSymlinks () {
  let s = fs.lstatSync('./shared')
  if (!s.isSymbolicLink()) {
    console.log('Fixing up shared symlinks')

    try {
      exec('del shared', null, {cwd: path.join(process.cwd(), '.')})
    } catch (_) { }
    try {
      exec('mklink /j shared ..\\shared', null, {cwd: path.join(process.cwd(), '.')})
    } catch (_) { }
  }

  s = fs.lstatSync('../react-native/shared')
  if (!s.isSymbolicLink()) {
    console.log('Fixing up shared symlinks')

    try {
      exec('del shared', null, {cwd: path.join(process.cwd(), '..', 'react-native')})
    } catch (_) { }
    try {
      exec('mklink /j shared ..\\shared', null, {cwd: path.join(process.cwd(), '..', 'react-native')})
    } catch (_) { }
  }
}

function exec (command, env, options) {
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
  exec(info.shell, info.env)
}

if (info.code) {
  info.code()
}
