import {app} from 'electron'
import path from 'path'

const isWindows = process.platform === 'win32'
const htmlPrefix = isWindows ? `file:///` : `file://`
const hotRoot = 'http://localhost:4000/dist'
const distRoot = path.resolve(__DEV__ || __PROFILE__ ? './desktop/dist' : path.join(app.getAppPath(), './desktop/dist'))
const fileRoot = `${htmlPrefix}${(`${distRoot}/`).replaceAll(path.sep, '/')}`

export const htmlURL = (name: string, query?: string) => {
  const base = __HOT__ ? `${hotRoot}/${name}${__FILE_SUFFIX__}.html` : `${fileRoot}${name}${__FILE_SUFFIX__}.html`
  return query ? `${base}?${query}` : base
}

export const preloadPath = path.join(distRoot, `preload${__FILE_SUFFIX__}.bundle.js`)
