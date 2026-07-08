import {app} from 'electron'
import path from 'path'

const isWindows = process.platform === 'win32'
const htmlPrefix = isWindows ? `file:///` : `file://`
const distRoot = path.resolve(__DEV__ || __PROFILE__ ? './desktop/dist' : path.join(app.getAppPath(), './desktop/dist'))
const fileRoot = `${htmlPrefix}${(`${distRoot}/`).replaceAll(path.sep, '/')}`

// In hot dev the renderer is served as an unbundled ESM graph by the Vite dev
// server, so windows must load their document from that http origin (they can't
// be loaded from file://). Cold dev + prod load the built html from file://.
// Vite keeps the shells at their source paths in both cases, so the same
// relative path is used for the http origin and the dist file root.
const devServerOrigin = 'http://localhost:4000'
const htmlRelPath: Record<string, string> = {
  main: 'desktop/renderer/main.html',
  remote: 'desktop/remote/remote.html',
}

export const htmlURL = (name: string, query?: string) => {
  const rel = htmlRelPath[name] ?? `${name}.html`
  const base = __HOT__ ? `${devServerOrigin}/${rel}` : `${fileRoot}${rel}`
  return query ? `${base}?${query}` : base
}

export const preloadPath = path.join(distRoot, `preload${__FILE_SUFFIX__}.bundle.js`)
