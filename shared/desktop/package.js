// @flow
import del from 'del'
import fs from 'fs-extra'
import klawSync from 'klaw-sync'
import minimist from 'minimist'
import os from 'os'
import packager from 'electron-packager'
import path from 'path'
import webpack from 'webpack'

// absolute path relative to this script
const desktopPath = (...args) => path.join(__dirname, ...args)

// recursively copy a folder over and allow only files with the extensions passed as onlyExts
const copySyncFolder = (src, target, onlyExts) => {
  const srcRoot = desktopPath(src)
  const dstRoot = desktopPath(target)
  const files = klawSync(srcRoot, {filter: item => onlyExts.includes(path.extname(item.path))})
  const relSrcs = files.map(f => f.path.substr(srcRoot.length))
  const dsts = relSrcs.map(f => path.join(dstRoot, f))

  relSrcs.forEach((s, idx) => fs.copySync(path.join(srcRoot, s), dsts[idx]))
}

const copySync = (src, target, options) => {
  fs.copySync(desktopPath(src), desktopPath(target), {...options, dereference: true})
}

const argv = minimist(process.argv.slice(2), {string: ['appVersion']})

const appName = 'Keybase'
const shouldUseAsar = argv.asar || argv.a || false
const shouldBuildAll = argv.all || false
// $FlowIssue // flow-typed libdef is pretty weak, thinks this might be a boolean
const shouldBuildAnArch: ?string = argv.arch
// $FlowIssue // flow-typed libdef is pretty weak, thinks this might be a boolean
const appVersion: string = argv.appVersion || '0.0.0'
// $FlowIssue // flow-typed libdef is pretty weak, thinks this might be a boolean
const comment: string = argv.comment || ''
// $FlowIssue // flow-typed libdef is pretty weak, thinks this might be a boolean
const outDir: string = argv.outDir || ''
const appCopyright = 'Copyright (c) 2015, Keybase'
const companyName = 'Keybase, Inc.'

const packagerOpts = {
  appBundleId: 'keybase.Electron',
  appCopyright: appCopyright,
  appVersion: appVersion,
  asar: shouldUseAsar,
  buildVersion: appVersion + comment,
  dir: desktopPath('./build'),
  helperBundleId: 'keybase.ElectronHelper',
  ignore: ['.map', '/test($|/)', '/tools($|/)', '/release($|/)', '/node_modules($|/)'],
  name: appName,
}

function main() {
  del.sync(desktopPath('dist'))
  del.sync(desktopPath('build'))

  copySync('Icon.png', 'build/desktop/Icon.png')
  copySync('Icon@2x.png', 'build/desktop/Icon@2x.png')
  copySyncFolder('../images', 'build/images', ['.gif', '.png'])
  fs.removeSync(desktopPath('build/images/folders'))
  fs.removeSync(desktopPath('build/images/iconfont'))
  copySyncFolder('renderer', 'build/desktop/renderer', ['.html'])
  copySync('renderer/renderer-load.js', 'build/desktop/renderer/renderer-load.js')
  fs.removeSync(desktopPath('build/desktop/renderer/fonts'))

  fs.writeJsonSync(desktopPath('build/package.json'), {
    main: 'desktop/dist/main.bundle.js',
    name: appName,
    version: appVersion,
  })

  const icon = argv.icon

  if (icon) {
    // $FlowIssue
    packagerOpts.icon = icon
  }

  // use the same version as the currently-installed electron
  console.log('Finding electron version')
  try {
    // $FlowIssue
    packagerOpts.electronVersion = require('../package.json').devDependencies.electron
    console.log('Found electron version:', packagerOpts.electronVersion)
  } catch (err) {
    console.log("Couldn't parse yarn list to find electron:", err)
    process.exit(1)
  }

  try {
    startPack()
  } catch (err) {
    console.log('Error startPack: ', err)
    process.exit(1)
  }
}

function startPack() {
  console.log('Starting webpack build\nInjecting __VERSION__: ', appVersion)
  process.env.APP_VERSION = appVersion
  const webpackConfig = require('./webpack.config.babel.js').default(null, {mode: 'production'})
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    if (stats.hasErrors()) {
      console.error(stats.toJson('errors-only').errors)
      process.exit(1)
    }

    copySyncFolder('./dist', 'build/desktop/sourcemaps', ['.map'])
    copySyncFolder('./dist', 'build/desktop/dist', ['.js', '.ttf', '.png'])
    fs.removeSync(desktopPath('build/desktop/dist/fonts'))

    del(desktopPath('release'))
      .then(() => {
        if (shouldBuildAll) {
          // build for all platforms
          const archs = ['ia32', 'x64']
          const platforms = ['linux', 'win32', 'darwin']

          platforms.forEach(plat => {
            archs.forEach(arch => {
              pack(plat, arch, postPack(plat, arch))
            })
          })
        } else if (shouldBuildAnArch) {
          // build for a specified arch on current platform only
          pack(os.platform(), shouldBuildAnArch, postPack(os.platform(), shouldBuildAnArch))
        } else {
          // build for current platform only
          pack(os.platform(), os.arch(), postPack(os.platform(), os.arch()))
        }
      })
      .catch(err => {
        console.error(err)
        process.exit(1)
      })
  })
}

function pack(plat, arch, cb) {
  // there is no darwin ia32 electron
  if (plat === 'darwin' && arch === 'ia32') return

  let packageOutDir = outDir
  if (packageOutDir === '') packageOutDir = desktopPath(`release/${plat}-${arch}`)
  console.log('Packaging to', packageOutDir)

  let opts = {
    ...packagerOpts,
    arch,
    out: packageOutDir,
    platform: plat,
    prune: true,
  }

  if (plat === 'win32') {
    opts = {
      ...opts,
      'version-string': {
        CompanyName: companyName,
        FileDescription: appName,
        OriginalFilename: appName + '.exe',
        ProductName: appName,
      },
    }
  }

  packager(opts, cb)
}

function postPack(plat, arch) {
  return (err, filepath) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    const subdir = plat === 'darwin' ? 'Keybase.app/Contents/Resources' : 'resources'
    const dir = path.join(filepath[0], subdir, 'app/desktop/dist')
    const files = ['index', 'main', 'component-loader'].map(p => p + '.bundle.js')
    files.forEach(file => {
      try {
        const stats = fs.statSync(path.join(dir, file))
        if (!stats.isFile() && stats.size > 0) {
          console.error(`Detected a problem with packaging ${file}: ${stats.isFile()} ${stats.size}`)
          process.exit(1)
        }
      } catch (err) {
        console.error(`${path.join(dir, file)} doesn't exist`)
        console.error(err)
        process.exit(1)
      }
    })
    console.log(`${plat}-${arch} finished!`)
  }
}

main()
