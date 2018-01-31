// @flow
import Icon from './icon'
import * as React from 'react'
import {globalColors, glamorous} from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {Image} from 'react-native'

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
  skipBackgroundAfterLoaded?: boolean,
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

class UserImage extends React.PureComponent<ImageProps> {
  render() {
    const {borderRadius, url, size, onLoadEnd, opacity = 1} = this.props
    return (
      <Image
        source={url}
        onLoadEnd={onLoadEnd}
        style={{
          borderRadius,
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
class Border extends React.PureComponent<{borderColor: any, borderRadius: number}> {
  render() {
    return (
      <Box
        style={{
          borderWidth: borderSize,
          bottom: borderOffset,
          left: borderOffset,
          margin: borderSize / 2,
          position: 'absolute',
          right: borderOffset,
          top: borderOffset,
          borderColor: this.props.borderColor,
          borderRadius: this.props.borderRadius,
        }}
      />
    )
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
      skipBackgroundAfterLoaded,
    } = this.props

    const borderRadius = this.props.isTeam
      ? sizeToTeamBorderRadius[String(this.props.size)]
      : this.props.size / 2

    return (
      <ClickableBox onClick={onClick} feedback={false} style={boxStyle(style, size)}>
        <Box style={boxStyle(style, size)}>
          {!skipBackground &&
            (!skipBackgroundAfterLoaded || !this.state.loaded) && (
              <Background
                loaded={this.state.loaded}
                loadingColor={loadingColor}
                borderRadius={borderRadius}
              />
            )}
          {!!url && (
            <UserImage
              opacity={opacity}
              onLoadEnd={this._onLoadOrError}
              size={size}
              url={url}
              borderRadius={borderRadius}
            />
          )}
          {!!borderColor && <Border borderColor={borderColor} borderRadius={borderRadius} />}
          {followIconType && (
            <Icon type={followIconType} style={iconStyle(followIconSize, followIconStyle)} />
          )}
          {children}
        </Box>
      </ClickableBox>
    )
  }
}

const sizes = [176, 112, 80, 64, 48, 40, 32, 24, 16, 12]

const iconStyles = sizes.reduce((map, size) => {
  map[String(size)] = {height: size, width: size}
  return map
}, {})

const boxStyles = sizes.reduce((map, size) => {
  map[String(size)] = {height: size, position: 'relative', width: size}
  return map
}, {})

const iconStyle = (size, style) =>
  style ? {...iconStyles[String(size)], ...style} : iconStyles[String(size)]
const boxStyle = (style, size) => (style ? {...boxStyles[String(size)], ...style} : boxStyles[String(size)])

export default AvatarRender
