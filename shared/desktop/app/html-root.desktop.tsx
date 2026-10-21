import {app} from 'electron'
import path from 'path'
import {appOrigin} from './app-protocol.desktop'

// Filesystem root of the app's files (app.asar when packaged); the app scheme
// serves from here.
export const appRoot = path.resolve(__DEV__ || __PROFILE__ ? '.' : app.getAppPath())
const distRoot = path.join(appRoot, 'desktop', 'dist')

// In hot dev the renderer is served as an unbundled ESM graph by the Vite dev
// server, so windows load their document from that http origin. Cold dev + prod
// load the built html through the app scheme. Vite keeps the shells at their
// source paths in both cases, so the same relative path is used for the http
// origin and the dist root.
const devServerOrigin = 'http://localhost:4000'
export const pageOrigin = __HOT__ ? devServerOrigin : appOrigin
const pageRoot = __HOT__ ? devServerOrigin : `${appOrigin}/desktop/dist`
const htmlRelPath: Record<string, string> = {
  main: 'desktop/renderer/main.html',
  remote: 'desktop/remote/remote.html',
}

export const htmlURL = (name: string, query?: string) => {
  const rel = htmlRelPath[name] ?? `${name}.html`
  const base = `${pageRoot}/${rel}`
  return query ? `${base}?${query}` : base
}

export const preloadPath = path.join(distRoot, `preload${__FILE_SUFFIX__}.bundle.js`)
