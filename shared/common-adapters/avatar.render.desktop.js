// @noflow i havea  pr where this is changed a bunch
import Icon from './icon'
import * as React from 'react'
import {globalColors, glamorous, desktopStyles} from '../styles'
import type {IconType} from './icon'

export type URLType = ?(string | Array<{height: number, width: number, uri: string}>)
export type AvatarSize = 176 | 112 | 80 | 64 | 48 | 40 | 32 | 24 | 16 | 12
export type URLMap = {
  '200': string,
  '360': string,
  '40': string,
}

export type Props = {|
  skipBackground?: boolean,
  borderColor?: string,
  children?: any,
  following?: ?boolean,
  followsYou?: ?boolean,
  followIconSize: number,
  isPlaceholder: boolean,
  loadingColor?: string,
  onAvatarLoaded?: () => void,
  onClick?: ?(event: SyntheticEvent<>) => void,
  opacity?: number,
  size: AvatarSize,
  style?: ?Object,
  // TODO flow type to allow one or the other, not both url and username etc
  url?: URLType,
  username?: ?string,
|}

type ImageProps = {
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

// The background is a separate layer due to a chrome bug where if you keep it as a background of an img (for example) it'll bleed the edges
const backgroundOffset = 1
const BackgroundDiv = glamorous.div(
  {
    bottom: backgroundOffset,
    left: backgroundOffset,
    position: 'absolute',
    right: backgroundOffset,
    top: backgroundOffset,
  },
  props => ({
    backgroundColor: props.loadingColor || globalColors.lightGrey,
    borderRadius: props.borderRadius,
  })
)
class Background extends React.PureComponent<{borderRadius: any}> {
  render() {
    return <BackgroundDiv borderRadius={this.props.borderRadius} />
  }
}

// The actual image
const UserImageDiv = glamorous.div(
  {
    backgroundSize: 'cover',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  props => {
    const {opacity = 1} = props
    return {
      backgroundImage: props.url,
      borderRadius: props.borderRadius,
      height: props.size,
      maxWidth: props.size,
      minWidth: props.size,
      opacity,
    }
  }
)
class UserImage extends React.PureComponent<ImageProps> {
  render() {
    return (
      <UserImageDiv
        opacity={this.props.opacity}
        size={this.props.size}
        url={this.props.url}
        borderRadius={this.props.borderRadius}
      />
    )
  }
}

const borderOffset = 1
const borderSize = 2
// Layer on top to extend outside of the image
const Border = ({borderColor, size, borderRadius}) => (
  <div
    style={{
      background: globalColors.transparent,
      borderRadius,
      bottom: borderOffset,
      boxShadow: `0px 0px 0px ${borderSize}px ${borderColor}`,
      left: borderOffset,
      maxWidth: size,
      minWidth: size,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
    }}
  />
)

class AvatarRender extends React.PureComponent<Props, State> {
  render() {
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(this.props.size)] : '50%'

    return (
      <div
        onClick={this.props.onClick}
        style={{
          ...desktopStyles.noSelect,
          height: this.props.size,
          maxWidth: this.props.size,
          minHeight: this.props.size,
          minWidth: this.props.size,
          position: 'relative',
          ...this.props.style,
        }}
      >
        {!this.props.skipBackground && <Background borderRadius={borderRadius} />}
        {this.props.url && (
          <UserImage
            opacity={this.props.opacity}
            size={this.props.size}
            url={this.props.url}
            borderRadius={borderRadius}
          />
        )}
        {!!this.props.borderColor && (
          <Border borderColor={this.props.borderColor} size={this.props.size} borderRadius={borderRadius} />
        )}
        {this.props.followIconType && (
          <Icon type={this.props.followIconType} style={this.props.followIconStyle} />
        )}
        {this.props.children}
      </div>
    )
  }
}

export default AvatarRender
