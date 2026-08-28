import type {CSSProperties} from 'react'
import type {TextStyle, ViewStyle} from 'react-native'

// encodeURIComponent leaves !'()*~ unescaped, but the media url allowlist rejects
// them, so escape those too. Callers escape exactly once: this is deliberately not
// idempotent, since a file really can be named "50%20off.mp4".
const encodePathSegment = (segment: string) =>
  encodeURIComponent(segment).replaceAll(
    /[!'()*~]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )

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
