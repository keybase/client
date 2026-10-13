import fs from 'node:fs'
import os from 'os'
import {packager, type Options} from '@electron/packager'
import path from 'path'
import {build} from 'vite'
import {makeNodeConfig} from './vite.node.mts'
import {createRequire} from 'node:module'
import {parseArgs} from 'node:util'
import {fileURLToPath} from 'node:url'
import {electronChecksums} from './electron-sums.mts'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TEMP_SKIP_BUILD: boolean = false

// absolute path relative={true} to this script
const desktopPath = (...args: Array<string>) => path.join(__dirname, ...args)

// recursively copy a folder over and allow only files with the extensions passed as onlyExts
const copySyncFolder = (src: string, target: string, onlyExts: Array<string>) => {
  const srcRoot = desktopPath(src)
  const dstRoot = desktopPath(target)
  fs.readdirSync(srcRoot, {recursive: true, withFileTypes: true})
    .filter(d => !d.isDirectory() && onlyExts.includes(path.extname(d.name)))
    .forEach(d => {
      const from = path.join(d.parentPath, d.name)
      const dst = path.join(dstRoot, path.relative(srcRoot, from))
      fs.mkdirSync(path.dirname(dst), {recursive: true})
      fs.cpSync(from, dst)
    })
}

const copySync = (src: string, target: string, options?: fs.CopySyncOptions) => {
  const dst = desktopPath(target)
  fs.mkdirSync(path.dirname(dst), {recursive: true})
  fs.cpSync(desktopPath(src), dst, {...options, dereference: true})
}

// strict: false so extra flags the packaging scripts pass through (e.g. --network-concurrency) are ignored
const {values} = parseArgs({
  options: {
    appVersion: {type: 'string'},
    arch: {type: 'string'},
    comment: {type: 'string'},
    icon: {type: 'string'},
    outDir: {type: 'string'},
    platform: {type: 'string'},
    saltpackIcon: {type: 'string'},
  },
  strict: false,
})
const stringArg = (v: string | boolean | undefined) => (typeof v === 'string' ? v : '')

const appName = 'Keybase'
const shouldUseAsar = false
const arch = stringArg(values.arch) || os.arch()
const platform = stringArg(values.platform) || os.platform()
const appVersion = stringArg(values.appVersion) || '0.0.0'
const comment = stringArg(values.comment)
const outDir = stringArg(values.outDir)
const saltpackIcon = stringArg(values.saltpackIcon)
const appCopyright = 'Copyright (c) 2024, Keybase'
const companyName = 'Keybase, Inc.'
const electronVersion = (require('../package.json') as {devDependencies: {electron: string}}).devDependencies
  .electron
console.log('Found electron version:', electronVersion)

const packagerOpts: Options = {
  appBundleId: 'keybase.Electron',
  appCopyright: appCopyright,
  appVersion: appVersion,
  asar: shouldUseAsar,
  buildVersion: String(appVersion) + String(comment),
  darwinDarkModeSupport: true,
  dir: desktopPath('./build'),
  download: {checksums: electronChecksums},
  electronVersion,
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
  extraResource: saltpackIcon ? [saltpackIcon] : undefined,
  helperBundleId: 'keybase.ElectronHelper',
  icon: stringArg(values.icon),
  ignore: [/\.map/, /\/test($|\/)/, /\/tools($|\/)/, /\/release($|\/)/, /\/node_modules($|\/)/],
  name: appName,
  protocols: [
    {
      name: 'Keybase',
      schemes: ['keybase'],
    },
  ],
  prune: true,
}

if (!packagerOpts.extraResource?.[0]) {
  console.warn(
    `Missing 'saltpack.icns' from yarn package arguments. Need an icon to associate ".saltpack" files with Electron on macOS, Windows, and Linux.`
  )
}

async function main() {
  if (TEMP_SKIP_BUILD) {
    for (let i = 0; i < 10; ++i) {
      console.log('TEMP_SKIP_BUILD true@!!')
    }
  } else {
    fs.rmSync(desktopPath('dist'), {force: true, recursive: true})
    fs.rmSync(desktopPath('build'), {force: true, recursive: true})
  }

  copySync('Icon.png', 'build/desktop/Icon.png')
  copySync('Icon@2x.png', 'build/desktop/Icon@2x.png')
  copySyncFolder('../images', 'build/images', ['.gif', '.png'])
  if (!TEMP_SKIP_BUILD) {
    fs.rmSync(desktopPath('build/images/folders'), {force: true, recursive: true})
    fs.rmSync(desktopPath('build/images/iconfont'), {force: true, recursive: true})
    fs.rmSync(desktopPath('build/images/mock'), {force: true, recursive: true})
    fs.rmSync(desktopPath('build/desktop/renderer/fonts'), {force: true, recursive: true})
  }

  const buildPkgPath = desktopPath('build/package.json')
  fs.mkdirSync(path.dirname(buildPkgPath), {recursive: true})
  fs.writeFileSync(buildPkgPath, JSON.stringify({main: 'desktop/dist/node.bundle.js', name: appName, version: appVersion}))

  try {
    await startPack()
  } catch (err) {
    console.log('Error startPack: ', err)
    process.exit(1)
  }
}

async function startPack() {
  console.log('Starting vite build\nInjecting __VERSION__: ', appVersion)
  process.env['APP_VERSION'] = appVersion
  const isProfile = process.env['PROFILE'] === 'true'
  try {
    if (!TEMP_SKIP_BUILD) {
      // Renderer first (its config wipes dist), then the node + preload bundles.
      await build({mode: 'production'})
      await build(makeNodeConfig('node', {isDev: false, isHot: false, isProfile, watch: false}))
      await build(makeNodeConfig('preload', {isDev: false, isHot: false, isProfile, watch: false}))
    }

    copySyncFolder('./dist', 'build/desktop/sourcemaps', ['.map'])
    copySyncFolder('./dist', 'build/desktop/dist', ['.js', '.css', '.ttf', '.png', '.gif', '.html'])
    fs.rmSync(desktopPath('build/desktop/dist/fonts'), {force: true, recursive: true})

    fs.rmSync(desktopPath('release'), {force: true, recursive: true})

    const aps = [[platform, arch]]
    await Promise.all(
      aps.map(async ([plat, arch]) => {
        try {
          const appPaths = await pack(plat!, arch!)
          postPack(appPaths, plat!, arch!)
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

  const opts: Options = {
    ...packagerOpts,
    arch: arch as Options['arch'],
    out: packageOutDir,
    platform: plat as Options['platform'],
    ...(plat === 'win32'
      ? {
          win32metadata: {
            CompanyName: companyName,
            FileDescription: appName,
            OriginalFilename: appName + '.exe',
            ProductName: appName,
          },
        }
      : null),
  }
  console.log('Building using options', opts)

  const ret = await packager(opts)
  return ret
}

function postPack(appPaths: Array<string>, plat: string, arch: string) {
  if (appPaths.length === 0) {
    console.log(`${plat}-${arch} finished with no app bundles`)
    return
  }
  const subdir = plat === 'darwin' ? 'Keybase.app/Contents/Resources' : 'resources'
  const dir = path.join(appPaths[0]!, subdir, 'app/desktop/dist')
  // Vite emits node/preload as *.bundle.js at dist root, and the renderer shells
  // at their source paths (their hashed js/css live under assets/).
  const files = [
    'node.bundle.js',
    'preload.bundle.js',
    'desktop/renderer/main.html',
    'desktop/remote/remote.html',
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
