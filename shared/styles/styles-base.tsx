export const urlEscapeFilePath = (path: string) => {
  if (path.startsWith('file://')) {
    const parts = path.split('/')
    parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]!)
    return parts.join('/')
  }
  return path
}

export const castStyleDesktop = (style: unknown) => style
export const castStyleNative = (style: unknown) => style

