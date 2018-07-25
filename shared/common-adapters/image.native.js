// @flow
import * as React from 'react'
import {NativeImage} from './mobile.native'
import type {Props, ReqProps} from './image'

const Image = ({src, style}: Props) => (
  <NativeImage source={{uri: src}} style={[{resizeMode: 'contain'}, style]} />
)

const RequireImage = ({src, style}: ReqProps) => (
  <NativeImage source={src} style={[{resizeMode: 'contain'}, style]} />
)

export default Image
export {RequireImage}
