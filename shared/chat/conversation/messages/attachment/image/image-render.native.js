// @flow
import * as React from 'react'
import {NativeImage, NativeDimensions} from '../../../../../common-adapters/native-wrappers.native'

import type {ImageRenderProps} from './image-render'

export function ImageRender({onLoad, style, src}: ImageRenderProps) {
  const source = typeof src === 'string' ? {uri: src} : src
  return <NativeImage onLoad={onLoad} source={source} style={style} resizeMode="contain" />
}

export function imgMaxWidth() {
  const {width: maxWidth} = NativeDimensions.get('window')
  return Math.min(320, maxWidth - 60)
}
