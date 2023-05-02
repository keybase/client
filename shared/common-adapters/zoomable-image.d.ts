import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  onZoomed?: (z: boolean) => void // desktop only
  // onLoad?: () => void
}

export default class ZoomableImage extends React.Component<Props> {}
