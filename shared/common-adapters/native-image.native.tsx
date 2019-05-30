import * as React from 'react'
import {Image, ImageProps} from 'react-native'
// import FastImageImpl from 'react-native-fast-image'
// import {isArray} from 'lodash-es'

export class NativeImage extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

// This might be causing a lot of memory pressure on android. testing to see if turning it off helps
// export class FastImage extends React.Component<ImageProps> {
// static getSize = Image.getSize
// render() {
// let source = this.props.source
// if (isArray(this.props.source)) {
// source = this.props.source[0] // TODO smarter choice?
// }
// return !!source && !!source.uri && <FastImageImpl {...this.props} source={source} />
// }
// }
//
export const FastImage = NativeImage
