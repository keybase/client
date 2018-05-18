// @flow
import * as React from 'react'
import {NativeImage} from './index.native'

type Props = {
  src: string,
  style?: any,
}

export default ({src, style}: Props) => {
  const source = {uri: `file://${src}`}
  return <NativeImage source={source} style={{resizeMode: 'contain', ...style}} />
}
