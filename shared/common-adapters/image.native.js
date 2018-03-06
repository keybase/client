// @flow
import * as React from 'react'
import {NativeImage} from './index.native'
import type {Props} from './image'
import {styleSheetCreate} from '../styles'

export default ({src, style}: Props) => {
  const source = {uri: `file://${src}`}
  return <NativeImage source={source} style={[styles.image, style]} />
}

const styles = styleSheetCreate({
  image: {
    resizeMode: 'contain',
  },
})
