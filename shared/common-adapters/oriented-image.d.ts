import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  forwardedRef?: any
  src: string
  style?: StylesCrossPlatform
  onDragStart?: (e: React.SyntheticEvent) => void
  onLoad?: (e: React.SyntheticEvent) => void
  onError?: () => void
}

export default class OrientedImage extends React.Component<Props> {
  _context: CanvasRenderingContext2D | null
}
