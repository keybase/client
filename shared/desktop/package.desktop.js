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
  const files = klawSync(srcRoot, {
    filter: item => {
      const ext = path.extname(item.path)
      return !ext || onlyExts.includes(ext)
    },
  })
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
const arch = argv.arch ? argv.arch.toString() : os.arch()
const platform = argv.platform ? argv.platform.toString() : os.platform()
const appVersion: string = (argv.appVersion: any) || '0.0.0'
const comment = argv.comment || ''
const outDir = argv.outDir || ''
const appCopyright = 'Copyright (c) 2015, Keybase'
const companyName = 'Keybase, Inc.'

const packagerOpts: any = {
  appBundleId: 'keybase.Electron',
  appCopyright: appCopyright,
  appVersion: appVersion,
  asar: shouldUseAsar,
  buildVersion: String(appVersion) + String(comment),
  dir: desktopPath('./build'),
  electronVersion: 0,
  helperBundleId: 'keybase.ElectronHelper',
  icon: null,
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
  fs.removeSync(desktopPath('build/images/mock'))
  copySyncFolder('renderer', 'build/desktop/renderer', ['.html'])
  fs.removeSync(desktopPath('build/desktop/renderer/renderer.dev.html'))
  copySync('renderer/renderer-load.desktop.js', 'build/desktop/renderer/renderer-load.desktop.js')
  fs.removeSync(desktopPath('build/desktop/renderer/fonts'))

  fs.writeJsonSync(desktopPath('build/package.json'), {
    main: 'desktop/dist/main.bundle.js',
    name: appName,
    version: appVersion,
  })

  const icon = argv.icon

  if (icon) {
    packagerOpts.icon = icon
  }

  // use the same version as the currently-installed electron
  console.log('Finding electron version')
  try {
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
              pack(plat, arch)
                .then(postPack(plat, arch))
                .catch(postPackError)
            })
          })
        } else {
          pack(platform, arch)
            .then(postPack(platform, arch))
            .catch(postPackError)
        }
      })
      .catch(err => {
        console.error(err)
        process.exit(1)
      })
  })
}

function pack(plat, arch: string): Promise<any> {
  // there is no darwin ia32 electron
  if (plat === 'darwin' && arch === 'ia32') return Promise.resolve()

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

  return packager(opts)
}

const postPackError = err => {
  console.error(err)
  process.exit(1)
}

function postPack(plat, arch) {
  return appPaths => {
    if (!appPaths || appPaths.length === 0) {
      console.log(`${plat}-${arch} finished with no app bundles`)
      return
    }
    const subdir = plat === 'darwin' ? 'Keybase.app/Contents/Resources' : 'resources'
    const dir = path.join(appPaths[0], subdir, 'app/desktop/dist')
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
