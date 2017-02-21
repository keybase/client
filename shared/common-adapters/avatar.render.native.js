// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {globalColors} from '../styles'
import {ClickableBox, NativeImage, Box} from './index.native'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  loadingColor: ?string,
  opacity: ?number,
  size: AvatarSize,
  url: string,
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
  url: ?string,
}

// The actual image
type UserImageType = {
  loaded: boolean,
}
class UserImage extends PureComponent<void, ImageProps, UserImageType> {
  state: UserImageType = {
    loaded: false,
  }

  _onLoadEnd = () => {
    this.setState({loaded: true})
  }

  render () {
    const {url, size, loadingColor, opacity = 1} = this.props

    return (
      <NativeImage
        source={url}
        onLoadEnd={this._onLoadEnd}
        style={{
          backgroundColor: this.state.loaded ? globalColors.white : loadingColor || globalColors.lightGrey,
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
    }}
  />
)

class AvatarRender extends PureComponent<void, Props, void> {
  render () {
    const {url, onClick, style, size, loadingColor, borderColor, opacity, followIconType, followIconStyle, children} = this.props

    return (
      <ClickableBox
        onClick={onClick}
        style={{
          height: size,
          position: 'relative',
          width: size,
          ...style,
        }}>
        <Box style={{height: size, width: size}}>
          {!!url && <UserImage
            opacity={opacity}
            loadingColor={loadingColor}
            size={size}
            url={url}
          /> }
          {!!borderColor && <Border borderColor={borderColor} size={size} />}
          {followIconType && <Icon type={followIconType} style={followIconStyle} />}
          {children}
        </Box>
      </ClickableBox>
    )
  }
}

export default AvatarRender
