// @flow
import * as I from 'immutable'
import Icon from './icon'
import React, {Component} from 'react'
import {NO_AVATAR} from './avatar'
import {globalStyles, globalColors} from '../styles'
import {resolveImageAsURL} from '../desktop/resolve-root'

import type {AvatarSize} from './avatar'

const noAvatar = resolveImageAsURL('icons', 'icon-placeholder-avatar-112-x-112@2x.png')

type Props = {
  borderColor: ?string,
  following: ?boolean,
  followsYou: ?boolean,
  loadingColor: ?string,
  onClick?: ?(() => void),
  opacity: ?number,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

const backgroundOffset = 1
const Background = ({loaded, loadingColor}) => (
  <div
    style={{
      backgroundColor: loaded ? globalColors.white : loadingColor || globalColors.lightGrey,
      borderRadius: '50%',
      bottom: backgroundOffset,
      left: backgroundOffset,
      position: 'absolute',
      right: backgroundOffset,
      top: backgroundOffset,
    }} />
)

const NoAvatarPlaceholder = ({size}) => (
  <img
    src={noAvatar}
    style={{
      height: size,
      width: size,
    }} />
)

const Image = ({url, size, onLoad, onError, opacity = 1}) => (
  <object
    data={url}
    type='image/jpg'
    onLoad={onLoad}
    onError={onError}
    style={{
      borderRadius: '50%',
      bottom: 0,
      height: size,
      left: 0,
      opacity,
      position: 'absolute',
      right: 0,
      top: 0,
      width: size,
    }}>
    <NoAvatarPlaceholder size={size} />
  </object>
)

const borderOffset = 1
const borderSize = 2
const Border = ({borderColor, size}) => (
  <div
    style={{
      background: globalColors.transparent,
      borderRadius: '100%',
      bottom: borderOffset,
      boxShadow: `0px 0px 0px ${borderSize}px ${borderColor}`,
      left: borderOffset,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
    }}
  />
)

const followStateToType = I.fromJS({
  '112': {
    'theyNo': {'youYes': 'icon-following-28'},
    'theyYes': {'youNo': 'icon-follow-me-28', 'youYes': 'icon-mutual-follow-28'},
  },
  '176': {
    'theyNo': {'youYes': 'icon-following-32'},
    'theyYes': {'youNo': 'icon-follow-me-32', 'youYes': 'icon-mutual-follow-32'},
  },
  '48': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
  '64': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
  '80': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
})

const followSizeToStyle = {
  '112': {bottom: 0, left: 80, position: 'absolute'},
  '176': {bottom: 6, left: 132, position: 'absolute'},
  '48': {bottom: 0, left: 32, position: 'absolute'},
  '64': {bottom: 0, left: 45, position: 'absolute'},
  '80': {bottom: 0, left: 57, position: 'absolute'},
}

const FollowDots = ({size, following, followsYou}) => {
  const type = followStateToType.getIn([String(size), `they${followsYou ? 'Yes' : 'No'}`, `you${following ? 'Yes' : 'No'}`])
  return type ? <Icon type={type} style={followSizeToStyle[size]} /> : null
}

class AvatarRender extends Component<void, Props, State> {
  state: State = {
    loaded: false,
  }

  _onLoadOrError: ?(event: any) => void;

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.url !== nextProps.url) {
      this.setState({loaded: false})
    }
  }

  componentDidMount () {
    this._onLoadOrError = (event) => {
      this.setState({loaded: true})
    }
  }

  componentWillUnmount () {
    // Don't let the callback do anything if we've unmounted
    this._onLoadOrError = null
  }

  render () {
    const {url, onClick, style, size, loadingColor, borderColor, following, followsYou, opacity} = this.props
    return (
      <div
        onClick={onClick}
        style={{
          ...globalStyles.noSelect,
          height: size,
          position: 'relative',
          width: size,
          ...style,
        }}>
        <Background loaded={this.state.loaded} loadingColor={loadingColor} />
        {url && <Image
          onLoad={e => this._onLoadOrError && this._onLoadOrError(e)}
          onError={e => this._onLoadOrError && this._onLoadOrError(e)}
          size={size}
          opacity={opacity}
          url={url === NO_AVATAR ? noAvatar : url}
        /> }
        {!!borderColor && <Border borderColor={borderColor} />}
        <FollowDots following={following} followsYou={followsYou} size={size} />
      </div>
    )
  }
}

export default AvatarRender
