import {rimrafSync} from 'rimraf'
import fs from 'fs-extra'
import os from 'os'
import packager, {type Options} from 'electron-packager'
import path from 'path'
import webpack from 'webpack'
import rootConfig from './webpack.config.babel'
import {readdir} from 'node:fs/promises'

const TEMP_SKIP_BUILD: boolean = false

// To get the hashes download the SHASUMS.txt file and run ./extract-electron-shasums.sh

// prettier-ignore
const electronChecksums = {
  ['electron-v24.4.0-darwin-arm64.zip']: '49346a2e32b9349cfb539e6a7029797d55d2a81bd48ca145c8103ce3a7611999',
  ['electron-v24.4.0-darwin-x64.zip']: '5c570b4ceca9fc3aefa7c6445b734590f466eff85aacabdf398913239a11fcac',
  ['electron-v24.4.0-linux-arm64.zip']: '28e559ec7833fab83d851983252048497c887cb1621f47865b89069a0be0deb0',
  ['electron-v24.4.0-linux-x64.zip']: '84f5ed6c8c1dc93cbb539c8a07880149db5475480ebabeb48b0171d67510d27f',
  ['electron-v24.4.0-win32-x64.zip']: '96a1c0432f409b8052e92fba94692243fa489891926946f836d3e28e78bd34b7',
  ['hunspell_dictionaries.zip']: '757bf921fed076122114d4a5d336fffc7ffb3a09da32a60ea518a45a787c9441',
}

// absolute path relative to this script
const desktopPath = (...args: Array<string>) => path.join(__dirname, ...args)

async function walk(dir: string, onlyExts: Array<string>): Promise<Array<string>> {
  const dirents = await readdir(dir, {withFileTypes: true})
  const files = await Promise.all(
    dirents.map(async dirent => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? [res, ...(await walk(res, onlyExts))] : res
    })
  )

  return files.flat().filter(i => {
    const ext = path.extname(i)
    return !ext || onlyExts.includes(ext)
  })
}

// recursively copy a folder over and allow only files with the extensions passed as onlyExts
const copySyncFolder = async (src: string, target: string, onlyExts: Array<string>) => {
  const srcRoot = desktopPath(src)
  const dstRoot = desktopPath(target)
  const files = await walk(srcRoot, onlyExts)

  const relSrcs = files.map(f => f.substring(srcRoot.length))
  const dsts = relSrcs.map(f => path.join(dstRoot, f))

  relSrcs.forEach((s, idx) => fs.copySync(path.join(srcRoot, s), dsts[idx]))
}

const copySync = (src: string, target: string, options?: object) => {
  fs.copySync(desktopPath(src), desktopPath(target), {...options, dereference: true})
}

const getArgs = () => {
  const args = process.argv.slice(2)
  const ret = {
    appVersion: '',
    arch: '',
    comment: '',
    icon: '',
    outDir: '',
    platform: '',
    saltpackIcon: '',
  }

  args.forEach(a => {
    const [l, r] = a.split('=')
    if (r === undefined) {
      // single param?
    } else {
      if (l.startsWith('--')) {
        const k = l.substring(2)

        if (Object.prototype.hasOwnProperty.call(ret, k)) {
          ret[k] = r
        }
      } else {
        console.error('Weird argv key', a)
      }
    }
  })
  return ret
}

const argv = getArgs()

const appName = 'Keybase'
const shouldUseAsar = false
const arch = argv.arch || os.arch()
const platform = argv.platform || os.platform()
const appVersion = argv.appVersion || '0.0.0'
const comment = argv.comment
const outDir = argv.outDir
const icon = argv.icon
const saltpackIcon = argv.saltpackIcon
const appCopyright = 'Copyright (c) 2022, Keybase'
const companyName = 'Keybase, Inc.'

const packagerOpts: Options = {
  appBundleId: 'keybase.Electron',
  appCopyright: appCopyright,
  appVersion: appVersion,
  asar: shouldUseAsar,
  buildVersion: String(appVersion) + String(comment),
  darwinDarkModeSupport: true,
  dir: desktopPath('./build'),
  download: {checksums: electronChecksums},
  electronVersion: undefined,
  // macOS file association to saltpack files
  extendInfo: {
    CFBundleDocumentTypes: [
      {
        CFBundleTypeExtensions: ['saltpack'],
        CFBundleTypeIconFile: 'saltpack.icns',
        CFBundleTypeName: 'io.keybase.saltpack',
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSItemContentTypes: ['io.keybase.saltpack'],
      },
    ],
    UTExportedTypeDeclarations: [
      {
        UTTypeConformsTo: ['public.data'],
        UTTypeDescription: 'Saltpack file format',
        UTTypeIconFile: 'saltpack.icns',
        UTTypeIdentifier: 'io.keybase.saltpack',
        UTTypeReferenceURL: 'https://saltpack.org',
        UTTypeTagSpecification: {
          'public.filename-extension': ['saltpack'],
        },
      },
    ],
  },
  // Any paths placed here will be moved to the final bundle
  extraResource: [] as Array<string>,
  helperBundleId: 'keybase.ElectronHelper',
  icon: undefined,
  ignore: [/\.map/, /\/test($|\/)/, /\/tools($|\/)/, /\/release($|\/)/, /\/node_modules($|\/)/],
  name: appName,
  protocols: [
    {
      name: 'Keybase',
      schemes: ['keybase', 'web+stellar'],
    },
  ],
}

async function main() {
  if (TEMP_SKIP_BUILD) {
    for (let i = 0; i < 10; ++i) {
      console.log('TEMP_SKIP_BUILD true@!!')
    }
  } else {
    rimrafSync(desktopPath('dist'))
    rimrafSync(desktopPath('build'))
  }

  copySync('Icon.png', 'build/desktop/Icon.png')
  copySync('Icon@2x.png', 'build/desktop/Icon@2x.png')
  await copySyncFolder('../images', 'build/images', ['.gif', '.png'])
  if (TEMP_SKIP_BUILD) {
  } else {
    fs.removeSync(desktopPath('build/images/folders'))
    fs.removeSync(desktopPath('build/images/iconfont'))
    fs.removeSync(desktopPath('build/images/mock'))
    fs.removeSync(desktopPath('build/desktop/renderer/fonts'))
  }

  fs.writeJsonSync(desktopPath('build/package.json'), {
    main: 'desktop/dist/node.bundle.js',
    name: appName,
    version: appVersion,
  })

  if (icon) {
    packagerOpts.icon = icon
  }

  if (saltpackIcon) {
    packagerOpts.extraResource = [saltpackIcon]
  } else {
    console.warn(
      `Missing 'saltpack.icns' from yarn package arguments. Need an icon to associate ".saltpack" files with Electron on macOS, Windows, and Linux.`
    )
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
    await startPack()
  } catch (err) {
    console.log('Error startPack: ', err)
    process.exit(1)
  }
}

async function startPack() {
  console.log('Starting webpack build\nInjecting __VERSION__: ', appVersion)
  process.env.APP_VERSION = appVersion
  const webpackConfig = rootConfig(null, {mode: 'production'})
  try {
    if (TEMP_SKIP_BUILD) {
    } else {
      const stats = await new Promise<webpack.Stats | undefined>((resolve, reject) => {
        webpack(webpackConfig, (err, stats: webpack.Stats | undefined) => {
          if (err) {
            reject(err)
          } else {
            resolve(stats)
          }
        })
      })

      if (stats?.hasErrors()) {
        console.error(stats.toJson('errors-only').errors)
        process.exit(1)
      }
    }

    await copySyncFolder('./dist', 'build/desktop/sourcemaps', ['.map'])
    await copySyncFolder('./dist', 'build/desktop/dist', ['.js', '.ttf', '.png', '.html'])
    fs.removeSync(desktopPath('build/desktop/dist/fonts'))

    rimrafSync(desktopPath('release'))

    let aps = [[platform, arch]]
    await Promise.all(
      aps.map(async ([plat, arch]) => {
        try {
          const appPaths = await pack(plat, arch)
          postPack(appPaths, plat, arch)
        } catch (err) {
          console.error(err)
          process.exit(1)
        }
      })
    )
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

async function pack(plat: string, arch: string) {
  // there is no darwin ia32 electron
  if (plat === 'darwin' && arch === 'ia32') return []

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
      // @ts-ignore does exist on win32
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

function postPack(appPaths: Array<string>, plat: string, arch: string) {
  if (!appPaths || appPaths.length === 0) {
    console.log(`${plat}-${arch} finished with no app bundles`)
    return
  }
  const subdir = plat === 'darwin' ? 'Keybase.app/Contents/Resources' : 'resources'
  const dir = path.join(appPaths[0], subdir, 'app/desktop/dist')
  const modules = ['node', 'main', 'tracker2', 'menubar', 'unlock-folders', 'pinentry']
  const files = [
    ...modules.map(p => p + '.bundle.js'),
    ...modules.filter(p => p !== 'node').map(p => p + '.html'),
  ]
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

main()
  .then(() => {})
  .catch(() => {})
