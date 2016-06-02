// @flow

import React, {Component} from 'react'
import {Image, PixelRatio, Platform} from 'react-native'
import type {Props} from './avatar'
import {Box, Icon} from '../common-adapters'
import {images} from './icon.paths.native'
import * as shared from './avatar.shared'

export default class Avatar extends Component {
  props: Props;

  constructor (props: Props) {
    super(props)
  }

  render () {
    const width = this.props.size
    const height = this.props.size
    const uri = shared.createAvatarUrl(this.props)

    // Hack AW: As of react-native 0.24.1, it appears that iOS takes in dp
    //  for the borderRadius, while Android (incorrectly) takes in pixels. This
    //  hack handles the conversion between pixels and dp on Android.
    const borderRadius = width / 2 * (Platform.OS === 'android' ? PixelRatio.get() : 1);

    return (
      <Image
        style={{resizeMode: 'contain', width, height, borderRadius}}
        defaultSource={images['placeholder-avatar']}
        source={{uri}} />
    )
  }
}
