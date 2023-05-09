import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  hideControls?: boolean | null
  onUrlError?: (err: string) => void
  style?: Styles.StylesCrossPlatform | null
  url: string
  allowFile?: boolean
  muted?: boolean
}

export type State = {
  containerHeight: number
  containerWidth: number
  loadedVideoSize: boolean
  videoHeight: number
  videoWidth: number
}

export default class extends React.Component<Props> {}
