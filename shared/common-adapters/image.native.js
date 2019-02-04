// @flow
import * as React from 'react'
import {NativeImage} from './native-image.native'
import type {Props, ReqProps} from './image'

const Image = ({src, style}: Props) => <NativeImage source={{uri: src}} style={style} resizeMode="contain" />

const RequireImage = ({src, style}: ReqProps) => (
  <NativeImage source={src} style={style} resizeMode="contain" />
)

export default Image
export {RequireImage}
