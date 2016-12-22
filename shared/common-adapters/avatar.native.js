// @flow
// TODO pull in username loading logic from desktop
import * as shared from './avatar.shared'
import Box from './box'
import React, {Component} from 'react'
import _ from 'lodash'
import {TouchableOpacity, Image} from 'react-native'
import {globalStyles} from '../styles'
import {iconMeta} from './icon.constants'

import type {Props} from './avatar'

type State = {
  avatarLoaded: boolean,
  errored: boolean,
}

class Avatar extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {avatarLoaded: false, errored: false}
  }

  componentWillReceiveProps (nextProps: Props) {
    const url = shared.createAvatarUrl(this.props)
    const nextUrl = shared.createAvatarUrl(nextProps)

    if (url !== nextUrl) {
      this.setState({avatarLoaded: false, errored: false})
    }
  }

  render () {
    const {size} = this.props
    const uri = shared.createAvatarUrl(this.props)
    const propsOpacity = this.props.hasOwnProperty('opacity') ? this.props.opacity : 1.0
    const opacity = this.state.avatarLoaded ? propsOpacity : 0

    const showLoadingColor = (this.props.loadingColor && !this.state.avatarLoaded) || this.props.forceLoading
    const showNoAvatar = !showLoadingColor && (!this.state.avatarLoaded || !uri || this.state.errored)

    return (
      <TouchableOpacity
        style={{...stylesContainer(size), ...this.props.style}}
        disabled={!this.props.onClick}
        onPress={this.props.onClick}
        activeOpacity={0.8}>
        <Box style={stylesContainer(size)}>
          {this.props.backgroundColor &&
            <Box
              style={_.omit({...stylesImage(size),
                backgroundColor: this.props.backgroundColor,
              }, 'resizeMode')} />}
          {!!uri && <Image
            style={{...stylesImage(size), opacity}}
            onError={() => this.setState({errored: true})}
            onLoad={() => this.setState({avatarLoaded: true})}
            source={{uri}} />}
          {showNoAvatar &&
            <Image
              style={stylesPlaceholderImage(size)}
              source={placeholder(size)} />}
          {showLoadingColor && <Box style={{...(_.omit(stylesImage(size), 'resizeMode')), backgroundColor: this.props.loadingColor}} />}

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

export default Avatar
