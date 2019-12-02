import * as React from 'react'
import {Image, ImageProps, ImageURISource} from 'react-native'
import RNFI from 'react-native-fast-image'
import isArray from 'lodash/isArray'

export class NativeImage extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

class FastImageImpl extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    if (typeof this.props.source === 'number') {
      return null
    }

    let source: ImageURISource
    if (isArray(this.props.source)) {
      source = this.props.source[0] // TODO smarter choice?
    } else {
      source = this.props.source
    }

    if (!source || !source.uri) {
      return null
    }
    return <RNFI {...this.props} source={source} />
  }
}

export const FastImage = FastImageImpl
