/* One-shot production/dev build of all three desktop targets via the Vite JS API:
 * renderer (web, multi-page) + node (main) + preload. Renderer runs first because
 * its config wipes desktop/dist (emptyOutDir); the node/preload builds append.
 *
 * Usage: node desktop/vite-build.mts [--mode production|development]
 */
import {build} from 'vite'
import {makeNodeConfig} from './vite.node.mts'

const modeIdx = process.argv.indexOf('--mode')
const mode: 'production' | 'development' =
  (modeIdx >= 0 ? process.argv[modeIdx + 1] : undefined) === 'production' ? 'production' : 'development'
const isDev = mode !== 'production'
const isProfile = process.env['PROFILE'] === 'true'

async function main() {
  // Renderer (web). Loads vite.config.mts. emptyOutDir wipes dist first.
  await build({mode})

  // Node main + preload. Appended to dist (emptyOutDir: false).
  await build(makeNodeConfig('node', {isDev, isHot: false, isProfile, watch: false}))
  await build(makeNodeConfig('preload', {isDev, isHot: false, isProfile, watch: false}))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
