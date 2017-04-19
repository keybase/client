// @flow
import React from 'react'
import {NativeImage} from '../../../../common-adapters/native-wrappers.native'

import type {ImageRenderProps} from './image'

export function ImageRender ({style, src}: ImageRenderProps) {
  const source = typeof src === 'string' ? {uri: 'file://' + src} : src
  return <NativeImage source={source} style={style} />
}
