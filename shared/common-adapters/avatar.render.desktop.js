// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles'
import {resolveImageAsURL} from '../desktop/resolve-root'
import {NO_AVATAR} from './avatar'

import type {AvatarSize} from './avatar'

const noAvatar = resolveImageAsURL('icons', 'icon-placeholder-avatar-112-x-112@2x.png')

type Props = {
  borderColor: ?string,
  followsYou: ?boolean,
  following: ?boolean,
  loadingColor: ?string,
  onClick?: ?(() => void),
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

const FollowDots = ({size, following, followsYou}) => {
  const circleSize = Math.round(size / 8)
  const outlineSize = Math.round(circleSize / 4)

  const followingDot = <div
    style={{
      background: following ? globalColors.green : globalColors.grey,
      borderRadius: '100%',
      bottom: Math.round(size / 20),
      boxShadow: `0px 0px 0px ${outlineSize}px ${globalColors.white}`,
      height: circleSize,
      position: 'absolute',
      right: Math.round(size / 10),
      width: circleSize,
    }}
  />

  const followsYouDot = followsYou ? <div
    style={{
      background: globalColors.white,
      borderRadius: '100%',
      bottom: Math.round((size / 20 + circleSize / 1.5)),
      boxShadow: `0px 0px 0px ${outlineSize}px ${globalColors.white},
      inset 0px 0px 0px ${outlineSize}px ${globalColors.green}`,
      height: circleSize,
      position: 'absolute',
      right: Math.round((size / 10 - circleSize / 1.5)),
      width: circleSize,
    }}
  /> : null

  return (
    <div>
      {followsYouDot}
      {followingDot}
    </div>
  )
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
        {size > 16 && (following || followsYou) && <FollowDots following={following} followsYou={followsYou} size={size} />}
      </div>
    )
  }
}

export default AvatarRender
