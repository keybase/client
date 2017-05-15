// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {globalColors} from '../styles'
import {ClickableBox, NativeImage, Box} from './index.native'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  onLoadEnd: () => void,
  opacity: ?number,
  size: AvatarSize,
  url: string,
}

type Props = {
  borderColor: ?string,
  children: any,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  followIconSize: number,
  loadingColor: ?string,
  onClick?: ?() => void,
  opacity: ?number,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

// Android doesn't handle background colors border radius setting
const backgroundOffset = 1
const Background = ({loaded, loadingColor, size}) => (
  <Box
    style={{
      backgroundColor: loaded ? globalColors.white : loadingColor || globalColors.lightGrey,
      borderRadius: size / 2,
      bottom: backgroundOffset,
      left: backgroundOffset,
      position: 'absolute',
      right: backgroundOffset,
      top: backgroundOffset,
    }}
  />
)

class UserImage extends PureComponent<void, ImageProps, void> {
  render() {
    const {url, size, onLoadEnd, opacity = 1} = this.props

    return (
      <NativeImage
        source={url}
        onLoadEnd={onLoadEnd}
        style={{
          borderRadius: size / 2,
          bottom: 0,
          height: size,
          left: 0,
          opacity,
          position: 'absolute',
          right: 0,
          top: 0,
          width: size,
        }}
      />
    )
  }
}

const borderOffset = -1
const borderSize = 2
// Layer on top to extend outside of the image
const Border = ({borderColor, size}) => (
  <Box
    style={{
      borderColor,
      borderRadius: size / 2,
      borderWidth: borderSize,
      bottom: borderOffset,
      left: borderOffset,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
      margin: borderSize / 2,
    }}
  />
)

class AvatarRender extends PureComponent<void, Props, State> {
  state: State = {
    loaded: false,
  }

  _mounted: boolean = false

  _onLoadOrError = () => {
    if (this._mounted) {
      this.setState({loaded: true})
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.url !== nextProps.url) {
      this.setState({loaded: false})
    }
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const {
      url,
      onClick,
      style,
      size,
      loadingColor,
      borderColor,
      opacity,
      followIconType,
      followIconStyle,
      followIconSize,
      children,
    } = this.props

    return (
      <ClickableBox onClick={onClick} feedback={false}>
        <Box
          style={{
            height: size,
            position: 'relative',
            width: size,
            ...style,
          }}
        >
          <Background loaded={this.state.loaded} loadingColor={loadingColor} size={size} />
          {!!url &&
            <UserImage opacity={opacity} onLoadEnd={this._onLoadOrError} size={size} url={url} />}
          {!!borderColor && <Border borderColor={borderColor} size={size} />}
          {followIconType &&
            <Icon
              type={followIconType}
              style={{
                ...followIconStyle,
                width: followIconSize,
                height: followIconSize,
              }}
            />}
          {children}
        </Box>
      </ClickableBox>
    )
  }
}

export default AvatarRender
