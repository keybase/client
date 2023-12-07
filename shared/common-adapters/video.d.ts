import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  hideControls?: boolean
  onUrlError?: (err: string) => void
  style?: Styles.StylesCrossPlatform
  url: string
  allowFile?: boolean
  muted?: boolean
  autoPlay?: boolean
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
