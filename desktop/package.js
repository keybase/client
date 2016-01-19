'use strict'

const os = require('os')
const webpack = require('webpack')
const cfg = require('./webpack.config.production.js')
const packager = require('electron-packager')
const del = require('del')
const exec = require('child_process').exec
const argv = require('minimist')(process.argv.slice(2))
const devDeps = Object.keys(require('./package.json').devDependencies)
const fs = require('fs-extra')

const appName = 'Keybase'
const shouldUseAsar = argv.asar || argv.a || false
const shouldBuildAll = argv.all || false
const shouldBuildAnArch = argv.arch || false
const appVersion = argv.appVersion || '0.0.0'
const comment = argv.comment || ''

// Inject app version
cfg.plugins.push(
  new webpack.DefinePlugin({
    '__VERSION__': JSON.stringify(appVersion)
  })
)

console.log('Injecting __VERSION__: ', appVersion)

del.sync('dist')
del.sync('build')

fs.copySync('./Icon.png', 'build/desktop/Icon.png')
fs.copySync('./Icon@2x.png', 'build/desktop/Icon@2x.png')
fs.copySync('../react-native/react/native', 'build/react-native/react/native', {filter: f => f.endsWith('.html')})
fs.copySync('../react-native/react/images', 'build/react-native/react/images')
fs.copySync('./node_modules/font-awesome/css/font-awesome.min.css', 'build/desktop/node_modules/font-awesome/css/font-awesome.min.css')
fs.copySync('./node_modules/font-awesome/fonts/fontawesome-webfont.woff2', 'build/desktop/node_modules/font-awesome/fonts/fontawesome-webfont.woff2')
fs.copySync('./renderer', 'build/desktop/renderer', {filter: f => !f.endsWith('.js')})

fs.writeJsonSync('build/package.json', {
  name: appName,
  version: appVersion,
  main: 'desktop/dist/main.bundle.js'
})

const DEFAULT_OPTS = {
  'app-bundle-id': 'keybase.Electron',
  'helper-bundle-id': 'keybase.ElectronHelper',
  'app-version': appVersion,
  'build-version': appVersion + comment,
  dir: './build',
  name: appName,
  asar: shouldUseAsar,
  ignore: [
    '.map',
    '/test($|/)',
    '/tools($|/)',
    '/release($|/)',
    'node_modules/\.bin'
  ].concat(devDeps.map(name => `/node_modules/${name}($|/)`))
}

const icon = argv.icon || argv.i || '../media/icons/Keybase.icns'

if (icon) {
  DEFAULT_OPTS.icon = icon
}

const version = argv.version || argv.v

if (version) {
  DEFAULT_OPTS.version = version
  startPack()
} else {
  // use the same version as the currently-installed electron-prebuilt
  console.log('Finding electron version')
  exec('npm list --dev electron-prebuilt', (err, stdout, stderr) => {
    DEFAULT_OPTS.version = '0.36.3'

    if (!err) {
      try {
        DEFAULT_OPTS.version = stdout.match(/electron-prebuilt@([0-9.]+)\n/)[1]
      } catch (ignore) { }
    }
    startPack()
  })
}

function startPack () {
  console.log('start pack...')
  webpack(cfg, (err, stats) => {
    if (err) {
      return console.error(err)
    }

    fs.copySync('./dist', 'build/desktop/sourcemaps', {filter: f => f.endsWith('.map')})
    fs.copySync('./dist', 'build/desktop/dist', {filter: f => f.endsWith('.js')})

    del('release')
    .then(paths => {
      if (shouldBuildAll) {
        // build for all platforms
        const archs = ['ia32', 'x64']
        const platforms = ['linux', 'win32', 'darwin']

        platforms.forEach(plat => {
          archs.forEach(arch => {
            pack(plat, arch, log(plat, arch))
          })
        })
      } else if (shouldBuildAnArch) {
        // build for a specified arch on current platform only
        pack(os.platform(), shouldBuildAnArch, log(os.platform(), shouldBuildAnArch))
      } else {
        // build for current platform only
        pack(os.platform(), os.arch(), log(os.platform(), os.arch()))
      }
    })
    .catch(err => {
      console.error(err)
    })
  })
}

function pack (plat, arch, cb) {
  // there is no darwin ia32 electron
  if (plat === 'darwin' && arch === 'ia32') return

  const opts = Object.assign({}, DEFAULT_OPTS, {
    platform: plat,
    arch: arch,
    prune: true,
    out: `release/${plat}-${arch}`
  })

  packager(opts, cb)
}

function log (plat, arch) {
  return (err, filepath) => {
    if (err) return console.error(err)
    console.log(`${plat}-${arch} finished!`)
  }
}
