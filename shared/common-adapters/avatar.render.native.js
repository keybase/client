// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {globalColors} from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import memoize from 'lodash/memoize'
import glamorous from 'glamorous-native'

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
  skipBackground?: boolean,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

// Android doesn't handle background colors border radius setting
const backgroundOffset = 1
const Background = ({loaded, loadingColor, size}) => {
  const View = glamorous.view(
    {
      bottom: backgroundOffset,
      left: backgroundOffset,
      position: 'absolute',
      right: backgroundOffset,
      top: backgroundOffset,
    },
    props => ({
      backgroundColor: props.loaded ? globalColors.white : props.loadingColor || globalColors.lightGrey,
      borderRadius: props.size / 2,
    })
  )
  return <View loaded={loaded} loadingColor={loadingColor} size={size} />
}

class UserImage extends PureComponent<void, ImageProps, void> {
  render() {
    const {url, size, onLoadEnd, opacity = 1} = this.props

    const Image = glamorous.image(
      {
        bottom: 0,
        left: 0,
        opacity,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      props => ({
        borderRadius: props.size / 2,
        height: props.size,
        width: props.size,
      })
    )

    return <Image source={url} onLoadEnd={onLoadEnd} size={size} />
  }
}

const borderOffset = -1
const borderSize = 2
// Layer on top to extend outside of the image
const Border = ({borderColor, size}) => {
  const View = glamorous.view(
    {
      borderWidth: borderSize,
      bottom: borderOffset,
      left: borderOffset,
      margin: borderSize / 2,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
    },
    props => ({
      borderColor: props.borderColor,
      borderRadius: props.size / 2,
    })
  )
  return <View size={size} borderColor={borderColor} />
}

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
      skipBackground,
    } = this.props

    return (
      <ClickableBox onClick={onClick} feedback={false}>
        <Box style={boxStyle(size, style)}>
          {!skipBackground &&
            <Background loaded={this.state.loaded} loadingColor={loadingColor} size={size} />}
          {!!url && <UserImage opacity={opacity} onLoadEnd={this._onLoadOrError} size={size} url={url} />}
          {!!borderColor && <Border borderColor={borderColor} size={size} />}
          {followIconType &&
            <Icon type={followIconType} style={iconStyle(followIconSize, followIconStyle)} />}
          {children}
        </Box>
      </ClickableBox>
    )
  }
}

const _iconStyle = memoize(size => ({
  height: size,
  width: size,
}))

const iconStyle = (size, style) => {
  return style ? {..._iconStyle(size), ...style} : _iconStyle(size)
}

const _boxStyle = memoize(size => ({
  height: size,
  position: 'relative',
  width: size,
}))

const boxStyle = (size, style) => {
  return style ? {..._boxStyle(size), ...style} : _boxStyle(size)
}

export default AvatarRender
