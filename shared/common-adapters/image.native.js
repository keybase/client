// @flow
import * as React from 'react'
import NativeImage from './native-image.native'
import type {Props} from './image'

export default ({src, style}: Props) => {
  const source = {uri: `file://${src}`}
  return <NativeImage source={source} style={{resizeMode: 'contain', ...style}} />
}
