import * as React from 'react'
import {Image, ImageProps, ImageURISource} from 'react-native'
import FastImageImpl from 'react-native-fast-image'
import {isArray} from 'lodash-es'

export class NativeImage extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

export class FastImage extends React.Component<ImageProps> {
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
    return <FastImageImpl {...this.props} source={source} />
  }
}
