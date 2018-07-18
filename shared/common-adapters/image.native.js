// @flow
import * as React from 'react'
import {NativeImage} from './mobile.native'
import type {Props, ReqProps} from './image'

const FileImage = ({src, style}: Props) => {
  const source = {uri: `file://${src}`}
  return <NativeImage source={source} style={[{resizeMode: 'contain'}, style]} />
}

const RequireImage = ({src, style}: ReqProps) => (
  <NativeImage source={src} style={[{resizeMode: 'contain'}, style]} />
)

export default FileImage
export {RequireImage}
