// @flow

import React, {Component} from 'react'
import {Image} from 'react-native'
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
    const url = shared.createUrl(this.props)

    return (
      <Image
        style={{resizeMode: 'contain', width, height, borderRadius: width / 2}}
        defaultSource={images['placeholder-avatar']}
        source={{uri: url}} />
    )
  }
}
