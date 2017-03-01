// @flow
import React from 'react'
import {NativeImage} from '../../../common-adapters/native-wrappers.native'

import type {ImageRenderProps} from './attachment.render'

export function ImageRender ({style, src}: ImageRenderProps) {
  return <NativeImage source={src} style={style} />
}
