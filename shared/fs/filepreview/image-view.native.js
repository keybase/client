// @flow
import * as React from 'react'
import {globalStyles} from '../../styles'
import {NativeImage} from '../../common-adapters/native-wrappers.native'
import {type ImageViewProps} from './image-view'

// NOTE that, unlike TextView, for ImageView we don't attempt to refresh token
// if what we have is invalid. See .desktop file for more details.

const ImageView = (props: ImageViewProps) => (
  <NativeImage source={{uri: props.url}} style={stylesImage} resizeMode="contain" />
)

const stylesImage = {
  ...globalStyles.flexGrow,
}

export default ImageView
