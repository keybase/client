// @flow
import * as shared from './avatar.shared'
import React, {Component} from 'react'
import type {Props} from './avatar'
import {Box} from '../common-adapters'
import {Image, TouchableOpacity} from 'react-native'
import {globalStyles} from '../styles/style-guide'
import {iconMeta} from './icon.constants'

type State = {
  avatarLoaded: boolean,
}

class Avatar extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {avatarLoaded: false}
  }

  render () {
    const {size} = this.props
    const uri = {uri: shared.createAvatarUrl(this.props)}

    return (
      <TouchableOpacity style={{...stylesContainer(size), ...this.props.style}} disabled={!this.props.onClick} onPress={this.props.onClick} activeOpacity={0.8}>
        <Box style={stylesContainer(size)}>
          {!!uri.uri && <Image
            style={{...stylesImage(size), opacity: this.state.avatarLoaded ? 1 : 0}}
            onLoad={e => this.setState({avatarLoaded: true})}
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
})

const stylesImage = (size: number) => ({
  ...stylesCommon(size),
  resizeMode: 'cover',
  borderRadius: size / 2,
})

const stylesPlaceholderImage = (size: number) => ({
  ...stylesImage(size),
  position: 'absolute',
  top: 0,
  left: 0,
})

export default Avatar
