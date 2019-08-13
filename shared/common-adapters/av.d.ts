import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  autoPlay?: boolean
  controls?: boolean
  loop?: boolean
  muted?: boolean // note that we're keeping playsInSilentModeIOS default which is false
  style?: Styles.StylesCrossPlatform | null
  url: string
}

export type VideoState = {
  containerHeight: number
  containerWidth: number
  loadedVideoSize: boolean
  videoHeight: number
  videoWidth: number
}

declare class Video extends React.Component<Props> {}
declare class Audio extends React.Component<Props> {}
