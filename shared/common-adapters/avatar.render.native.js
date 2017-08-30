// @flow
import Icon from './icon'
import * as React from 'react'
import {globalColors, glamorous} from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import memoize from 'lodash/memoize'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  onLoadEnd: () => void,
  opacity: ?number,
  size: AvatarSize,
  url: string,
  borderRadius: any,
}

type Props = {
  borderColor: ?string,
  children: any,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  followIconSize: number,
  isTeam?: boolean,
  loadingColor: ?string,
  onClick?: ?(event: SyntheticEvent<>) => void,
  opacity: ?number,
  skipBackground?: boolean,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

const sizeToTeamBorderRadius = {
  '112': 12,
  '12': 3,
  '16': 4,
  '176': 24,
  '24': 4,
  '32': 5,
  '40': 6,
  '48': 6,
  '64': 8,
  '80': 10,
}

// Android doesn't handle background colors border radius setting
const backgroundOffset = 1
const BackgroundView = glamorous.view(
  {
    bottom: backgroundOffset,
    left: backgroundOffset,
    position: 'absolute',
    right: backgroundOffset,
    top: backgroundOffset,
  },
  props => ({
    backgroundColor: props.loaded ? globalColors.white : props.loadingColor || globalColors.lightGrey,
    borderRadius: props.borderRadius,
  })
)

class Background extends React.PureComponent<{loaded: boolean, loadingColor: any, borderRadius: number}> {
  render() {
    return (
      <BackgroundView
        loaded={this.props.loaded}
        loadingColor={this.props.loadingColor}
        borderRadius={this.props.borderRadius}
      />
    )
  }
}

const UserImageImage = glamorous.image(
  {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  props => ({
    opacity: props.opacity,
    borderRadius: props.borderRadius,
    height: props.size,
    width: props.size,
  })
)
class UserImage extends React.PureComponent<ImageProps> {
  render() {
    const {borderRadius, url, size, onLoadEnd, opacity = 1} = this.props
    return (
      <UserImageImage
        opacity={opacity}
        source={url}
        onLoadEnd={onLoadEnd}
        size={size}
        borderRadius={borderRadius}
      />
    )
  }
}

const borderOffset = -1
const borderSize = 2
// Layer on top to extend outside of the image
const BorderView = glamorous.view(
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
    borderRadius: props.borderRadius,
  })
)
class Border extends React.PureComponent<{borderColor: any, borderRadius: number}> {
  render() {
    return <BorderView borderColor={this.props.borderColor} borderRadius={this.props.borderRadius} />
  }
}

class AvatarRender extends React.PureComponent<Props, State> {
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

    const borderRadius = this.props.isTeam
      ? sizeToTeamBorderRadius[String(this.props.size)]
      : this.props.size / 2

    return (
      <ClickableBox onClick={onClick} feedback={false} style={boxStyle(size, style)}>
        <Box style={boxStyle(size, style)}>
          {!skipBackground &&
            <Background loaded={this.state.loaded} loadingColor={loadingColor} borderRadius={borderRadius} />}
          {!!url &&
            <UserImage
              opacity={opacity}
              onLoadEnd={this._onLoadOrError}
              size={size}
              url={url}
              borderRadius={borderRadius}
            />}
          {!!borderColor && <Border borderColor={borderColor} borderRadius={borderRadius} />}
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
