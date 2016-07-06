// @flow

import React, {Component} from 'react'
import {Image, TouchableOpacity} from 'react-native'
import type {Props} from './avatar'
import {Box} from '../common-adapters'
import {images} from './icon.paths.native'
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

    return (
      <TouchableOpacity style={{...stylesContainer(size), ...this.props.style}} disabled={!this.props.onClick} onPress={this.props.onClick} activeOpacity={0.8}>
        <Box style={stylesContainer(size)}>
          <Image
            style={{...stylesImage(size), opacity: this.state.avatarLoaded ? 1 : 0}}
            onLoad={() => this.setState({avatarLoaded: true})}
            source={uri} />
          {!this.state.avatarLoaded &&
            <Image
              style={stylesPlaceholderImage(size)}
              source={placeholder(size)} />}
        </Box>
      </TouchableOpacity>
    )
  }
}

const placeholder = (size: number) => ({ // eslint-disable-line arrow-parens
  '176': images['icon-placeholder-avatar-176-x-176'],
  '112': images['icon-placeholder-avatar-112-x-112'],
  '80': images['icon-placeholder-avatar-80-x-80'],
  '64': images['icon-placeholder-avatar-64-x-64'],
  '48': images['icon-placeholder-avatar-48-x-48'],
  '32': images['icon-placeholder-avatar-32-x-32'],
  '24': images['icon-placeholder-avatar-24-x-24'],
  '16': images['icon-placeholder-avatar-16-x-16'],
}[String(size)])

const stylesCommon = (size: number) => ({ // eslint-disable-line arrow-parens
  width: size,
  height: size,
})

const stylesContainer = (size: number) => ({ // eslint-disable-line arrow-parens
  ...stylesCommon(size),
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
})

const stylesImage = (size: number) => ({ // eslint-disable-line arrow-parens
  ...stylesCommon(size),
  resizeMode: 'cover',
  borderRadius: size / 2,
})

const stylesPlaceholderImage = (size: number) => ({ // eslint-disable-line arrow-parens
  ...stylesImage(size),
  position: 'absolute',
  top: 0,
  left: 0,
})
