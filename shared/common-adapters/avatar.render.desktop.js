// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {NO_AVATAR} from './avatar'
import {globalStyles, globalColors} from '../styles'
import {resolveImageAsURL} from '../desktop/resolve-root'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

// hoist to parent and get all sizes for srcset
const noAvatar = resolveImageAsURL('icons', 'icon-placeholder-avatar-112-x-112@2x.png')

type ImageProps = {
  urls: Array<string>,
  size: AvatarSize,
  onLoad: () => void,
  onError: () => void,
  opacity: ?number,
}

type Props = {
  borderColor: ?string,
  children: any,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  loadingColor: ?string,
  onClick?: ?(() => void),
  opacity: ?number,
  size: AvatarSize,
  style?: ?Object,
  urls: ?Array<string>,
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

class Image extends PureComponent<void, ImageProps, void> {
  render () {
    const {urls, size, onLoad, onError, opacity = 1} = this.props
    return (
      <object
        data={urls[0]}
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
  }
}

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

class AvatarRender extends PureComponent<void, Props, State> {
  state: State = {
    loaded: false,
  }

  _mounted: boolean = false

  _onLoadOrError = (event) => {
    if (this._mounted) {
      this.setState({loaded: true})
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.urls !== nextProps.urls) {
      this.setState({loaded: false})
    }
  }

  componentDidMount () {
    this._mounted = true
  }

  componentWillUnmount () {
    this._mounted = false
  }

  render () {
    const {urls, onClick, style, size, loadingColor, borderColor, opacity, followIconType, followIconStyle, children} = this.props

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
        {urls && <Image
          onLoad={this._onLoadOrError}
          onError={this._onLoadOrError}
          size={size}
          opacity={opacity}
          urls={urls[0] === NO_AVATAR ? [noAvatar] : urls}
        /> }
        {!!borderColor && <Border borderColor={borderColor} />}
        {followIconType && <Icon type={followIconType} style={followIconStyle} />}
        {children}
      </div>
    )
  }
}

export default AvatarRender
