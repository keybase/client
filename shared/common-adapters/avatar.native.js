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
              source={images['placeholder-avatar']} />}
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
