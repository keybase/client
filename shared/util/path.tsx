import KB2 from '../util/electron.desktop'
const {pathSep} = KB2
// simple versions we use in the renderer

export const join = (...args: Array<string>) => {
  return [...args].join(pathSep).replace(new RegExp(`${pathSep}+`, 'g'), pathSep)
}

export const joinAddSep = (...args: Array<string>) => join(...args) + pathSep
