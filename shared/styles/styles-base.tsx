import type {CSSProperties} from 'react'
import type {ViewStyle} from 'react-native'

export const urlEscapeFilePath = (path: string) => {
  if (path.startsWith('file://')) {
    const parts = path.split('/')
    parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]!)
    return parts.join('/')
  }
  return path
}

export const castStyleDesktop = (style: unknown): CSSProperties | undefined => style as CSSProperties | undefined
export const castStyleNative = (style: unknown): ViewStyle | undefined => style as ViewStyle | undefined
