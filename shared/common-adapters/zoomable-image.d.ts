import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  zoomRatio?: number
  onLoaded?: () => void
  onIsZoomed?: (z: boolean) => void // desktop only
  dragPan?: boolean // desktop only, pan on drag only
  // mobile only but TODO desktop also
  onChanged?: (e: {height: number; width: number; x: number; y: number}) => void
}

export default class ZoomableImage extends React.Component<Props> {}
