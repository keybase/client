import * as React from 'react'
import * as Styles from '../../../../../styles'

export type Props = {
  mobileFullscreen: boolean
  mobileOnDismissFullscreen: () => void
  muted: boolean
  onLoadStart?: () => void
  onReady?: () => void
  onProgress?: (timeInSeconds: number) => void
  posterSrc?: string
  progressUpdateInterval?: number
  playFromSecondsOrPause?: number // set to undefined to pause
  style?: Styles.StylesCrossPlatform
  videoSrc: string
}

export default class extends React.Component<Props> {}

type PosterProps = {
  height: number
  posterSrc: string
  width: number
}
export class Poster extends React.Component<PosterProps> {}
