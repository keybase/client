import type {CSSProperties} from 'react'
import type {TextStyle, ViewStyle} from 'react-native'

// encodeURIComponent, but an existing percent escape is kept as-is instead of being
// escaped again, so escaping an already escaped path is a no-op
const encodePathSegment = (segment: string) =>
  encodeURIComponent(segment).replaceAll(/%25([0-9A-Fa-f]{2})/g, '%$1')

const filePrefix = 'file://'
export const urlEscapeFilePath = (path: string) => {
  if (path.startsWith(filePrefix)) {
    // every segment needs escaping, a space in a parent directory breaks the url too
    return filePrefix + path.slice(filePrefix.length).split('/').map(encodePathSegment).join('/')
  }
  return path
}

export const castStyleDesktop = (style: unknown): CSSProperties | undefined => style as CSSProperties | undefined
export const castStyleNative = (style: unknown): (TextStyle & ViewStyle) | undefined => style as (TextStyle & ViewStyle) | undefined
