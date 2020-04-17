import * as React from 'react'
import {NativeImage} from './native-image.native'
import {Props, ReqProps} from './image'

const Image = ({onLoad, src, style}: Props) => (
  <NativeImage
    onLoad={onLoad}
    source={{uri: __STORYSHOT__ ? 'shotsrc' : src}}
    style={style}
    resizeMode="contain"
  />
)

const RequireImage = ({src, style}: ReqProps) => (
  <NativeImage source={__STORYSHOT__ ? 'shotsrc' : src} resizeMode="contain" style={style} />
)

export default Image
export {RequireImage}
