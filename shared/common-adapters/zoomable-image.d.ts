import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  onIsZoomed?: (z: boolean) => void // desktop only
  // mobile only but TODO desktop also
  onChanged?: (e: {height: number; width: number; x: number; y: number}) => void
}

export default class ZoomableImage extends React.Component<Props> {}
