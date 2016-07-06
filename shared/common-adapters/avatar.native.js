// @flow

import React, {Component} from 'react'
import {Image, TouchableOpacity} from 'react-native'
import type {Props, AvatarSize} from './avatar'
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
    const {size, following, followsYou} = this.props
    const uri = {uri: shared.createAvatarUrl(this.props)}

    let friendshipBadge
    if (following && followsYou) {
      friendshipBadge = shared.mutualFollowingIcon(size)
    } else if (following) {
      friendshipBadge = shared.followingIcon(size)
    } else if (followsYou) {
      friendshipBadge = shared.followsMeIcon(size)
    }

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
              source={images[shared.avatarPlaceholder(size)]} />}
          {!!friendshipBadge && (<Image
            style={stylesBadgeImage(size)}
            source={images[friendshipBadge]} />)}
        </Box>
      </TouchableOpacity>
    )
  }
}

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

function stylesBadgeImage (size: AvatarSize): ?Object {
  const stylesBadgeImageBase = {
    position: 'absolute',
    bottom: 0,
    right: 0,
  }

  switch (size) {
    case 176:
      return {
        ...stylesBadgeImageBase,
        bottom: 5,
        right: 12,
      }
    case 112:
      return {
        ...stylesBadgeImageBase,
        right: 3,
      }
    case 80:
      return {
        ...stylesBadgeImageBase,
      }
    case 64:
      return {
        ...stylesBadgeImageBase,
        bottom: -4,
        right: -2,
      }
    case 48:
      return {
        ...stylesBadgeImageBase,
        bottom: -4,
        right: -4,
      }
  }

  return null
}
