// @flow
import del from 'del'
import fs from 'fs-extra'
import minimist from 'minimist'
import os from 'os'
import packager from 'electron-packager'
import path from 'path'
import webpack from 'webpack'
import webpackConfig from './webpack.config.production.js'
import {exec} from 'child_process'

const filterAllowOnlyTypes = (...types) => ({
  filter: f => types.some(type => f.endsWith(`.${type}`)),
})

const desktopPath = (...args) => path.join(__dirname, ...args)

const copySync = (src, target, options) => {
  fs.copySync(desktopPath(src), desktopPath(target), {
    ...options,
    dereference: true,
  })
}

const argv = minimist(process.argv.slice(2))

const appName = 'Keybase'
const shouldUseAsar = argv.asar || argv.a || false
const shouldBuildAll = argv.all || false
const shouldBuildAnArch = argv.arch || false
const appVersion = argv.appVersion || '0.0.0'
const comment = argv.comment || ''
const outDir = argv.outDir || ''
const appCopyright = 'Copyright (c) 2015, Keybase'

const packagerOpts = {
  'app-bundle-id': 'keybase.Electron',
  'helper-bundle-id': 'keybase.ElectronHelper',
  'app-version': appVersion,
  'build-version': appVersion + comment,
  'app-copyright': appCopyright,
  dir: desktopPath('./build'),
  name: appName,
  asar: shouldUseAsar,
  ignore: ['.map', '/test($|/)', '/tools($|/)', '/release($|/)', '/node_modules($|/)'],
}

function main() {
  // Inject app version
  webpackConfig.plugins.push(
    new webpack.DefinePlugin({
      __VERSION__: JSON.stringify(appVersion),
    })
  )

  console.log('Injecting __VERSION__: ', appVersion)

  del.sync(desktopPath('dist'))
  del.sync(desktopPath('build'))

  copySync('Icon.png', 'build/desktop/Icon.png')
  copySync('Icon@2x.png', 'build/desktop/Icon@2x.png')
  copySync('../images', 'build/images', filterAllowOnlyTypes('gif', 'png'))
  fs.removeSync(desktopPath('build/images/folders'))
  fs.removeSync(desktopPath('build/images/iconfont'))
  copySync('renderer', 'build/desktop/renderer', filterAllowOnlyTypes('html'))
  copySync('renderer/renderer-load.js', 'build/desktop/renderer/renderer-load.js')
  fs.removeSync(desktopPath('build/desktop/renderer/fonts'))

  fs.writeJsonSync(desktopPath('build/package.json'), {
    name: appName,
    version: appVersion,
    main: 'desktop/dist/main.bundle.js',
  })

  const icon = argv.icon

  if (icon) {
    // $FlowIssue
    packagerOpts.icon = icon
  }

  // use the same version as the currently-installed electron
  console.log('Finding electron version')
  exec('yarn list electron', {cwd: path.join(__dirname, '..')}, (err, stdout, stderr) => {
    if (!err) {
      try {
        // $FlowIssue
        packagerOpts.version = stdout.match(/electron@([0-9.]+)/)[1]
        console.log('Found electron version:', packagerOpts.version)
      } catch (err) {
        console.log("Couldn't parse yarn list to find electron:", err)
        process.exit(1)
      }
    } else {
      console.log("Couldn't list yarn to find electron:", err)
      process.exit(1)
    }

    startPack()
  })
}

function startPack() {
  console.log('start pack...')
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    copySync('./dist', 'build/desktop/sourcemaps', filterAllowOnlyTypes('map'))
    copySync('./dist', 'build/desktop/dist', filterAllowOnlyTypes('js', 'ttf', 'png'))
    fs.removeSync(desktopPath('build/desktop/dist/fonts'))

    del(desktopPath('release'))
      .then(() => {
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
    platform: plat,
    arch: arch,
    prune: true,
    out: packageOutDir,
  }

  if (plat === 'win32') {
    opts = {
      ...opts,
      'version-string': {
        OriginalFilename: appName + '.exe',
        FileDescription: appName,
        ProductName: appName,
      },
    }
  }

  packager(opts, cb)
}

function log(plat, arch) {
  return (err, filepath) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    const subdir = plat === 'darwin' ? 'Keybase.app/Contents/Resources' : 'resources'
    const dir = path.join(filepath[0], subdir, 'app/desktop/dist')
    const files = ['index', 'launcher', 'main', 'remote-component-loader'].map(
      p => p + '.bundle.js'
    )
    files.forEach(file => {
      try {
        const stats = fs.statSync(path.join(dir, file))
        if (!stats.isFile() && stats.size > 0) {
          console.error(
            `Detected a problem with packaging ${file}: ${stats.isFile()} ${stats.size}`
          )
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
