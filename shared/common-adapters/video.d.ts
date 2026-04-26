import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  hideControls?: boolean | undefined
  onUrlError?: ((err: string) => void) | undefined
  style?: Styles.StylesCrossPlatform | undefined
  url: string
  allowFile?: boolean | undefined
  muted?: boolean | undefined
  autoPlay?: boolean | undefined
}

export type State = {
  containerHeight: number
  containerWidth: number
  loadedVideoSize: boolean
  videoHeight: number
  videoWidth: number
}

declare const Video: (p: Props) => React.ReactNode
export default Video
