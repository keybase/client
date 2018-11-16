// @flow
import * as React from 'react'
import {Image, type ImageProps} from 'react-native'
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
    let source = this.props.source
    if (isArray(this.props.source)) {
      source = this.props.source[0] // TODO smarter choice?
    }
    return <FastImageImpl {...this.props} source={source} />
  }
}
