import * as React from 'react'
import type * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image from './image.native'

const Kb = {
  Image,
  ZoomableBox,
}

const ZoomableImage = (p: {src: string; style?: Styles.StylesCrossPlatform}) => {
  const {src, style} = p
  return (
    <Kb.ZoomableBox style={style}>
      <Kb.Image src={src} />
    </Kb.ZoomableBox>
  )
}

export default ZoomableImage
