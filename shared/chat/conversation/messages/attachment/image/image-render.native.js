// @flow
import * as React from 'react'
import {NativeImage, NativeDimensions} from '../../../../../common-adapters/native-wrappers.native'
import type {Props} from './image-render.types'

export function ImageRender({onLoad, style, src}: Props) {
  const source = typeof src === 'string' ? {uri: src} : src
  return <NativeImage onLoad={onLoad} source={source} style={style} resizeMode="contain" />
}

export function imgMaxWidth() {
  const {width: maxWidth} = NativeDimensions.get('window')
  return Math.min(320, maxWidth - 50)
}
