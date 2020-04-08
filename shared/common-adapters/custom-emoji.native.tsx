import * as React from 'react'
import {Props} from './custom-emoji'
import {FastImage} from './native-image.native'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  return (
    <FastImage
      source={{uri: src}}
      style={{
        height: size,
        width: size,
      }}
    />
  )
}

export default CustomEmoji
