import * as React from 'react'
import * as Styles from '../../../../../styles'

export type Props = {
  mobileFullscreen: boolean
  mobileOnDismissFullscreen: () => void
  muted: boolean
  onLoadStart?: () => void
  onLoadedMetadata?: () => void
  onProgress?: (timeInSeconds: number) => void
  posterSrc?: string
  progressUpdateInterval?: number
  playFromSecondsOrPause?: number // set to undefined to pause
  style?: Styles.StylesCrossPlatform
  videoSrc: string
}

export default class extends React.Component<Props> {}
