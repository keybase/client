// @flow

import React, {Component} from 'react'
import _ from 'lodash'
import {Image, TouchableOpacity, View} from 'react-native'
import type {Props} from './avatar'
import {Box} from '../common-adapters'
import {iconMeta} from './icon.constants'
import {globalStyles} from '../styles/style-guide'
import * as shared from './avatar.shared'

type State = {
  avatarLoaded: boolean,
}

export default class Avatar extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {avatarLoaded: false}
  }

  render () {
    const {size} = this.props
    const uri = {uri: shared.createAvatarUrl(this.props)}
    const propsOpacity = this.props.hasOwnProperty('opacity') ? this.props.opacity : 1.0
    const opacity = this.state.avatarLoaded ? propsOpacity : 0

    return (
      <TouchableOpacity
        style={{...stylesContainer(size), ...this.props.style}}
        disabled={!this.props.onClick}
        onPress={this.props.onClick}
        activeOpacity={0.8}>
        <Box style={stylesContainer(size)}>
          {this.props.hasBackgroundColor &&
            <View
              style={_.omit({...stylesImage(size),
                resizeMode: undefined,
                backgroundColor: this.props.hasBackgroundColor,
              }, 'resizeMode')} />}
          {!!uri.uri && <Image
            style={{...stylesImage(size), opacity}}
            onLoad={() => this.setState({avatarLoaded: true})}
            source={uri} />}
          {(!this.state.avatarLoaded || !uri.uri) &&
            <Image
              style={stylesPlaceholderImage(size)}
              source={placeholder(size)} />}
        </Box>
      </TouchableOpacity>
    )
  }
}

const placeholder = (size: number) => ({
  '176': iconMeta['icon-placeholder-avatar-176-x-176'].require,
  '112': iconMeta['icon-placeholder-avatar-112-x-112'].require,
  '80': iconMeta['icon-placeholder-avatar-80-x-80'].require,
  '64': iconMeta['icon-placeholder-avatar-64-x-64'].require,
  '48': iconMeta['icon-placeholder-avatar-48-x-48'].require,
  '32': iconMeta['icon-placeholder-avatar-32-x-32'].require,
  '24': iconMeta['icon-placeholder-avatar-24-x-24'].require,
}[String(size)])

const stylesCommon = (size: number) => ({
  width: size,
  height: size,
})

const stylesContainer = (size: number) => ({
  ...stylesCommon(size),
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
})

const stylesImage = (size: number) => ({
  ...stylesCommon(size),
  resizeMode: 'cover',
  borderRadius: size / 2,
  position: 'absolute',
  top: 0,
})

const stylesPlaceholderImage = (size: number) => ({
  ...stylesImage(size),
  position: 'absolute',
  top: 0,
  left: 0,
})
