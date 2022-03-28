import * as React from 'react'
import {Props} from './custom-emoji'
import {FastImage} from './native-image.native'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  const dimensions = {
    height: size,
    width: size,
  }

  return (
    <FastImage key={size} source={{uri: src}} style={dimensions} resizeMode={FastImage.resizeMode.contain} />
  )
}

export default CustomEmoji
