/* Vite bundler for the desktop (electron) app renderer + remote windows.
 *
 * Replaces desktop/webpack.config.mts. The node (main) and preload targets are
 * built separately (see desktop/vite.node.ts, consumed by the yarn-helper dev
 * orchestrator and package.desktop.mts) because they are node/electron targets,
 * not part of this web module graph.
 */
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {defineConfig, type Plugin} from 'vite'

const require = createRequire(import.meta.url)
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(rootDir, 'desktop/dist')
// CJS empty: only ever reached via alias + optimizeDeps (pre-bundled → browser-safe
// + CJS interop for arbitrary named imports).
const emptyModulePath = path.resolve(rootDir, 'desktop/empty-module.js')
// ESM empty: safe to serve directly in dev (resolveAssetSource, native-file fallback).
const emptyEsmPath = path.resolve(rootDir, 'desktop/empty-esm.js')
const ignoredModules = require('./ignored-modules') as Array<string>

export const devServerPort = 4000
export const devOrigin = `http://localhost:${devServerPort}`
const remoteDebugURL = 'http://localhost:8097'

// Packages in ignored-modules that need a REAL desktop stub (not an empty module),
// because renderer code imports their exports (e.g. @react-navigation/elements).
const stubbedModules: Record<string, string> = {
  'react-native-safe-area-context': path.resolve(rootDir, 'desktop/stubs/react-native-safe-area-context.js'),
  '@react-native-picker/picker': path.resolve(rootDir, 'desktop/stubs/react-native-picker.js'),
}

// Directories whose native.js / gif / png / jpg assets are null-loaded on desktop.
const nullLoadedAssetDirectories = [
  path.resolve(
    rootDir,
    'node_modules/@react-navigation/native-stack/node_modules/@react-navigation/elements/lib/module/assets'
  ),
  path.resolve(rootDir, 'node_modules/@react-navigation/elements/lib/module/assets'),
  path.resolve(rootDir, 'images/icons'),
]
const imagesMockDir = path.resolve(rootDir, 'images/mock')

export const makeDefines = (isDev: boolean, isHot: boolean, isProfile: boolean, fileSuffix: string) => ({
  __FILE_SUFFIX__: JSON.stringify(fileSuffix),
  __PROFILE__: JSON.stringify(isProfile),
  __DEV__: JSON.stringify(isDev),
  __HOT__: JSON.stringify(isHot),
  __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env['APP_VERSION']),
  // Platform globals are also inlined by babel.config.js (platformPlugin); defined
  // here too so any code not run through our babel pass still resolves them.
  isMobile: JSON.stringify(false),
  isElectron: JSON.stringify(true),
  isAndroid: JSON.stringify(false),
  isIOS: JSON.stringify(false),
  global: 'globalThis',
  'process.env.NODE_DEBUG': JSON.stringify(process.env['NODE_DEBUG']),
  'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
})

// react-native$ -> react-native-web (exact), desktop stubs, then every ignored
// module -> null-module.js, and finally '@' -> shared root. Vite/@rollup alias
// matches in array order (first match wins), so stubs must precede the null
// entries and '@' (most general) must come last.
type AliasEntry = {find: string | RegExp; replacement: string}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const makeAlias = (): Array<AliasEntry> => {
  const entries: Array<AliasEntry> = [
    // Point at react-native-web's CommonJS entry (not its ESM `module` build): the
    // ESM build is strictly checked by rolldown and genuinely lacks mobile-only
    // names (e.g. ActionSheetIOS) that desktop code imports but only uses behind
    // isMobile. CJS interop yields `undefined` for those, matching webpack.
    {
      find: /^react-native$/,
      replacement: path.resolve(rootDir, 'node_modules/react-native-web/dist/cjs/index.js'),
    },
    ...Object.entries(stubbedModules).map(([find, replacement]) => ({find, replacement})),
    {find: 'react-native/Libraries/Image/resolveAssetSource', replacement: emptyEsmPath},
    // Null out ignored modules and every subpath. Uses a whole-specifier regex
    // (not a string prefix): a string alias would append the leftover subpath
    // (e.g. 'react-native-screens/experimental' -> 'null-module.js/experimental'),
    // which is why webpack had to sort these longest-first. Regex replace matches
    // the entire id, so no subpath is appended.
    ...ignoredModules
      .filter(m => !(m in stubbedModules))
      .map(name => ({find: new RegExp(`^${escapeRe(name)}(/.*)?$`), replacement: emptyModulePath})),
    {find: '@', replacement: rootDir},
  ]
  return entries
}

// Pre-bundle every native-only package (nulled ones resolve via alias to
// empty-module, stubbed ones to their desktop stub). Both are CJS, and the Vite
// dev server can't see named exports on un-optimized local CJS files; as
// optimized needsInterop deps their named imports resolve (undefined for empties,
// the real stub values for stubs).
// Every nulled/stubbed bare package, pre-bundled by optimizeDeps so they resolve
// (via alias) to the CJS empty-module / desktop stub as browser-safe needsInterop
// deps rather than raw CJS files served to the browser.
const optimizeIncludes = [
  ...new Set([...ignoredModules.filter(m => !(m in stubbedModules)), ...Object.keys(stubbedModules)]),
]

// Null-load native/ios/android source files (they use @/ imports babel can't
// transform, and pull in native-only deps) and the ignored packages, plus the
// react-navigation asset dirs + images/icons, and (prod only) images/mock jpgs.
//
// Redirected to the CJS empty module with syntheticNamedExports so that
// `import {Foo} from './x.native'` / `import {addNotificationRequest} from
// 'react-native-kb'` resolve Foo to undefined instead of erroring on a missing
// named export. The prod rolldown build tolerates this via CJS interop; the Vite
// dev server strict-checks named exports, so syntheticNamedExports is what makes
// dev accept them. Mirrors webpack's null-loader behavior.
export const emptyFileModulesPlugin = (isDev: boolean): Plugin => {
  // The dev server (command 'serve') can serve the self-contained lenient ESM
  // empty; the build (rolldown, command 'build') needs the CJS empty for missing
  // named-import interop. Note isDev is true for both `vite build --mode
  // development` and the dev server, so it can't distinguish them.
  let isServe = false
  return {
  name: 'kb-empty-file-modules',
  enforce: 'pre',
  configResolved(config) {
    isServe = config.command === 'serve'
  },
  async resolveId(source, importer) {
    const clean = source.split('?')[0] ?? source
    // An explicit `.native`/`.ios`/`.android` import (e.g. '@/common-adapters/
    // portal.native') is only used in isMobile branches (dead on desktop), but its
    // named exports must still resolve. Redirect to the base module (strip the
    // platform suffix) so they resolve to the real desktop impl; fall back to the
    // empty module if there is no base.
    const nativeExt = clean.match(/^(.*)\.(native|ios|android)(\.(ts|js)x?)?$/)
    if (nativeExt) {
      // Prefer the desktop/base module (portal.native -> portal) so named exports
      // resolve to the real desktop impl. If there is no base (native-only file),
      // null it to empty-esm — processing the .native file itself is unsafe because
      // some have top-level native side effects (e.g. Animated.createAnimatedComponent).
      // empty-esm's `export *` keeps named imports lenient in dev + build.
      const base = nativeExt[1]!
      const resolved = await this.resolve(base, importer, {skipSelf: true})
      // Dev: self-contained lenient ESM (browser-safe + skips named-export check).
      // Build: CJS empty (rolldown tolerates missing named imports via interop; the
      // dev ESM's `export *` from an empty module would be strict-checked by rolldown).
      return resolved ?? (isServe ? emptyEsmPath : emptyModulePath)
    }
    // Nulled bare packages are handled by resolve.alias -> empty-module.js +
    // optimizeDeps (pre-bundled, browser-safe, CJS-interop for named imports).
    // Intercepting them here instead would serve the raw CJS file to the browser.
    return null
  },
  load(id) {
    const clean = id.split('?')[0] ?? id
    if (!isDev && clean.startsWith(imagesMockDir) && clean.endsWith('.jpg')) {
      return 'export default ""'
    }
    for (const dir of nullLoadedAssetDirectories) {
      if (clean.startsWith(dir) && /\.(native\.js|gif|png|jpg)$/.test(clean)) {
        return 'export default ""'
      }
    }
    return null
  },
  }
}

const joinCsp = (sources: Array<string | false | undefined>) => sources.filter(Boolean).join(' ')

const makeCsp = (isDev: boolean) =>
  [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'object-src http://127.0.0.1:*',
    'frame-src http://127.0.0.1:*',
    `font-src ${joinCsp(["'self'", isDev && devOrigin])}`,
    'media-src http://127.0.0.1:*',
    `img-src ${joinCsp([
      "'self'",
      'data:',
      'http://127.0.0.1:*',
      'https://keybase.io/',
      'https://pbs.twimg.com/',
      'https://avatars.githubusercontent.com/',
      'https://s3.amazonaws.com/keybase_processed_uploads/',
      isDev && devOrigin,
    ])}`,
    // Vite emits app CSS as external <link> stylesheets (webpack's style-loader
    // inlined them), so 'self'/dev-origin must be allowed, not just 'unsafe-inline'.
    `style-src ${joinCsp(["'self'", "'unsafe-inline'", isDev && devOrigin])}`,
    // In dev the renderer is the Vite ESM graph served from devOrigin, and
    // @vitejs/plugin-react injects an inline refresh preamble, so we need
    // 'unsafe-inline'/'unsafe-eval' + the dev origin. Prod stays strict.
    `script-src ${joinCsp(
      isDev ? ["'self'", devOrigin, remoteDebugURL, "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"]
    )}`,
    `connect-src ${joinCsp([
      "'self'",
      'http://127.0.0.1:*',
      isDev && devOrigin,
      isDev && `ws://localhost:${devServerPort}`,
      isDev && 'ws://localhost:8097',
    ])}`,
  ].join(';\n ')

// Inject CSP <meta> into every html shell, plus the react-devtools <script> into
// the main window in dev. The shells keep their source paths in the output
// (desktop/renderer/main.html, desktop/remote/remote.html) so Vite's relative
// asset URLs stay correct; html-root.desktop.tsx loads those same paths.
const htmlPlugin = (isDev: boolean): Plugin => ({
  name: 'kb-html',
  transformIndexHtml: {
    order: 'pre',
    handler(html, ctx) {
      const isMain = ctx.path.includes('/renderer/') || ctx.filename.includes('renderer')
      const csp = `<meta charset="utf-8" http-equiv="Content-Security-Policy" content="${makeCsp(isDev)}">`
      const devtools = isDev && isMain ? `\n    <script src="${remoteDebugURL}"></script>` : ''
      return html.replace('<!--kb-csp-->', csp + devtools)
    },
  },
})

// Babel plugin: rewrite a runtime `require('literal')` in an ESM module to a
// hoisted namespace import. The desktop build's rolldown does this automatically,
// but the Vite dev server leaves require() as-is → `require is not defined` at
// runtime. The codebase accesses require() results via `.default`/named/
// destructure, which `import * as ns` satisfies (hoisting is safe on desktop:
// dead-branch requires just pull a nulled/real desktop module). Only runs on
// modules that already use ESM syntax (transformMixedEsModules), so pure-CJS .js
// files (e.g. common-adapters/index-impl.js's lazy require barrel) are left for
// Vite's own CJS handling.
/* eslint-disable @typescript-eslint/no-explicit-any */
const requireToImportBabelPlugin = ({types: t}: {types: any}) => ({
  name: 'kb-require-to-import',
  visitor: {
    Program(path: any, state: any) {
      state.isEsm = path.node.body.some(
        (n: any) =>
          t.isImportDeclaration(n) ||
          t.isExportNamedDeclaration(n) ||
          t.isExportDefaultDeclaration(n) ||
          t.isExportAllDeclaration(n)
      )
    },
    CallExpression(path: any, state: any) {
      if (!state.isEsm) return
      const {node} = path
      if (
        t.isIdentifier(node.callee, {name: 'require'}) &&
        node.arguments.length === 1 &&
        t.isStringLiteral(node.arguments[0]) &&
        !path.scope.getBinding('require')
      ) {
        const source = node.arguments[0].value
        const program = path.scope.getProgramParent().path
        // Asset requires (images/fonts) are used as the URL value directly, like
        // webpack's `require('x.png')` returning the url — use a DEFAULT import so
        // the binding IS the url. Module requires access `.default`/named on the
        // result, so use a NAMESPACE import (interop-equivalent to require()).
        const isAsset = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico|ttf|woff2?|otf|eot|mp4|webm|mov|wav|mp3|m4a)$/i.test(
          source
        )
        const id = program.scope.generateUidIdentifier(isAsset ? 'kbasset' : 'kbreq')
        program.unshiftContainer(
          'body',
          t.importDeclaration(
            [isAsset ? t.importDefaultSpecifier(id) : t.importNamespaceSpecifier(id)],
            t.stringLiteral(source)
          )
        )
        path.replaceWith(t.cloneNode(id))
      }
    },
  },
})
/* eslint-enable @typescript-eslint/no-explicit-any */

// @vitejs/plugin-react@6 uses oxc (not babel) for JSX/fast-refresh and has no
// babel option, so react-compiler (babel-only) runs as a separate
// @rolldown/plugin-babel pass with the exported reactCompilerPreset — the
// react.dev-documented setup. Without it, un-memoized values cause effect loops
// (e.g. GlobalKeyEventHandler). Platform globals come from the Vite `define`,
// '@' from resolve.alias. The require->import plugin runs in the same pass.
export const makeReactPlugins = () => [
  react(),
  babel({presets: [reactCompilerPreset()], plugins: [requireToImportBabelPlugin]}),
]

export const sharedResolve = {
  alias: makeAlias(),
  extensions: [
    '.desktop.tsx',
    '.desktop.ts',
    '.desktop.js',
    '.web.js',
    '.mjs',
    '.js',
    '.jsx',
    '.tsx',
    '.ts',
    '.json',
  ],
}

export default defineConfig(({mode}) => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isProfile = !isDev && !!process.env['PROFILE']
  const fileSuffix = isDev ? '.dev' : isProfile ? '.profile' : ''

  return {
    root: rootDir,
    // Only the hot dev server loads the renderer over an http origin (base '/').
    // Cold dev builds + prod are loaded from file:// (relative base).
    base: isHot ? '/' : './',
    define: makeDefines(isDev, isHot, isProfile, fileSuffix),
    resolve: sharedResolve,
    plugins: [emptyFileModulesPlugin(isDev), ...makeReactPlugins(), htmlPlugin(isDev)],
    server: {
      port: devServerPort,
      strictPort: true,
      host: 'localhost',
    },
    // Force the nulled native packages to be pre-bundled (they resolve to the CJS
    // empty-module via alias). The Vite dev server strict-checks named exports on
    // un-optimized modules, so `import {addNotificationRequest} from
    // 'react-native-kb'` would otherwise fail; as optimized needsInterop deps,
    // arbitrary named imports resolve to undefined. Prod (rolldown) tolerates it
    // via CJS interop regardless.
    optimizeDeps: {
      include: optimizeIncludes,
    },
    build: {
      outDir: distDir,
      emptyOutDir: true,
      target: 'esnext',
      sourcemap: true,
      minify: !isDev,
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, 'desktop/renderer/main.html'),
          remote: path.resolve(rootDir, 'desktop/remote/remote.html'),
        },
      },
    },
  }
})
