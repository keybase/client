// @flow
import React from 'react'
import {NativeImage, NativeDimensions} from '../../../../common-adapters/native-wrappers.native'

import type {ImageRenderProps} from './image'

export function ImageRender({style, src}: ImageRenderProps) {
  const source = typeof src === 'string' ? {uri: 'file://' + src} : src
  return <NativeImage source={source} style={style} />
}

export function imgMaxWidth() {
  const {width: maxWidth} = NativeDimensions.get('window')
  return Math.min(320, maxWidth - 50)
}
