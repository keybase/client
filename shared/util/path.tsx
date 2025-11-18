// simple versions we use in the renderer, definitely doesn't handle edge cases but likely ok as-is

export const join = (...args: Array<string>) => {
  return [...args].join(C.pathSep).replace(new RegExp(`${C.pathSep}+`, 'g'), C.pathSep)
}

export const extname = (path: string) => {
  const parts = path.split(C.pathSep)
  const last = parts.at(-1)
  const idx = last?.lastIndexOf('.') ?? -1
  if (idx === -1) {
    return ''
  }

  return last?.substring(idx) ?? ''
}

export const basename = (path: string, extname: string) => {
  const parts = path.split(C.pathSep)
  const last = parts.at(-1)
  if (last?.endsWith(extname)) {
    return last.substring(0, last.length - extname.length)
  } else {
    return last
  }
}

export const dirname = (path: string) => {
  const parts = path.split(C.pathSep)
  parts.pop()
  return parts.join(C.pathSep)
}
