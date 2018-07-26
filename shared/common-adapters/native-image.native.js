// @flow
import * as React from 'react'
import {Image, type ImageProps} from 'react-native'

// Simple wrapper around Image that forces android to not fade

class NativeImage extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

export default NativeImage
