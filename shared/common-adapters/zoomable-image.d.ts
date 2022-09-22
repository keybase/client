import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
}

export class ZoomableImage extends React.Component<Props> {}
