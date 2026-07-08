/* Vite build configs for the electron node targets: main (node.desktop.tsx) and
 * preload (preload.desktop.tsx). These are node/electron bundles, not part of the
 * renderer web graph, so they are built via the Vite JS `build()` API (see the
 * dev orchestrator and package.desktop.mts) rather than the default web config.
 *
 * Unlike the renderer, these skip @vitejs/plugin-react (main-process code has no
 * JSX / react-refresh); esbuild strips TypeScript. Deps are bundled (ssr.noExternal)
 * because electron packaging excludes node_modules; only electron + node builtins
 * are external (provided at runtime).
 */
import path from 'node:path'
import {builtinModules} from 'node:module'
import {fileURLToPath} from 'node:url'
import type {InlineConfig, Plugin} from 'vite'
import {makeDefines, sharedResolve} from '../vite.config.mts'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const distDir = path.resolve(rootDir, 'desktop/dist')
const emptyModulePath = path.resolve(rootDir, 'desktop/empty-module.js')

const nodeExternals = [
  'electron',
  /^electron\//,
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
]

// Same file-pattern null-loading as the renderer (native/ios/android source files),
// as a safety net for anything the main-process graph reaches.
const emptyNativeFilesPlugin: Plugin = {
  name: 'kb-node-empty-native',
  enforce: 'pre',
  resolveId(source) {
    const clean = source.split('?')[0] ?? source
    if (/\.(native|ios|android)(\.(ts|js)x?)?$/.test(clean)) {
      return emptyModulePath
    }
    return null
  },
}

export type NodeTarget = 'node' | 'preload'

const entryFor: Record<NodeTarget, string> = {
  node: path.resolve(rootDir, 'desktop/app/node.desktop.tsx'),
  preload: path.resolve(rootDir, 'desktop/renderer/preload.desktop.tsx'),
}

export const makeNodeConfig = (
  target: NodeTarget,
  {
    isDev,
    isHot,
    isProfile,
    watch,
  }: {isDev: boolean; isHot: boolean; isProfile: boolean; watch?: boolean}
): InlineConfig => {
  const fileSuffix = isDev ? '.dev' : isProfile ? '.profile' : ''
  // preload.desktop.tsx is shared by the main build and the sandboxed preload.
  // Its `else` (main-process) branch runtime-requires kb2-impl.desktop, which
  // pulls in os/path/fs. rolldown bundles + hoists those builtin requires to the
  // top, so they run at preload load and crash the sandbox (no `os`). That branch
  // never runs in the sandbox (isRenderer is true there), so empty out kb2-impl
  // for the preload target only; the node/main build keeps the real module.
  const extraAlias =
    target === 'preload'
      ? [{find: '../app/kb2-impl.desktop', replacement: emptyModulePath}]
      : []
  return {
    root: rootDir,
    configFile: false,
    mode: isDev ? 'development' : 'production',
    define: makeDefines(isDev, isHot, isProfile, fileSuffix),
    resolve: {
      ...sharedResolve,
      alias: [...extraAlias, ...sharedResolve.alias],
      conditions: ['node', 'require', 'default'],
    },
    plugins: [emptyNativeFilesPlugin],
    ssr: {noExternal: true, target: 'node'},
    build: {
      outDir: distDir,
      emptyOutDir: false,
      target: 'node20',
      ssr: entryFor[target],
      minify: !isDev,
      sourcemap: true,
      watch: watch ? {} : null,
      rollupOptions: {
        external: nodeExternals,
        // Single self-contained CJS bundle per target (electron packaging excludes
        // node_modules and expects one node.bundle.js / preload.bundle.js).
        output: {
          format: 'cjs',
          entryFileNames: `${target}${fileSuffix}.bundle.js`,
          codeSplitting: false,
        },
      },
    },
  }
}
