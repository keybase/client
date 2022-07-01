import {pathSep} from '../constants/platform'
// simple versions we use in the renderer, definitely doesn't handle edge cases but likely ok as-is

export const join = (...args: Array<string>) => {
  return [...args].join(pathSep).replace(new RegExp(`${pathSep}+`, 'g'), pathSep)
}

export const joinAddSep = (...args: Array<string>) => join(...args) + pathSep

export const extname = (path: string) => {
  const parts = path.split(pathSep)
  const last = parts[parts.length - 1]
  const idx = last.lastIndexOf('.')
  if (idx === -1) {
    return ''
  }

  return last.substring(idx)
}

export const basename = (path: string, extname: string) => {
  const parts = path.split(pathSep)
  const last = parts[parts.length - 1]

  if (last.endsWith(extname)) {
    return last.substring(0, last.length - extname.length)
  } else {
    return last
  }
}

export const dirname = (path: string) => {
  const parts = path.split(pathSep)
  parts.pop()
  return parts.join(pathSep)
}
