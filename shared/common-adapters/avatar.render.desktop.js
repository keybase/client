// @flow
import Icon from './icon'
import * as React from 'react'
import {globalColors, glamorous, desktopStyles, collapseStyles} from '../styles'
import type {AvatarSize, Props} from './avatar.render'

type ImageProps = {
  opacity: ?number,
  size: AvatarSize,
  url: string,
  borderRadius: any,
}

type State = {
  loaded: boolean,
}

const sizeToTeamBorderRadius = {
  '128': 12,
  '16': 4,
  '32': 5,
  '48': 6,
  '64': 8,
  '96': 10,
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
      flexShrink: 0,
      height: props.size,
      opacity,
      width: props.size,
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
      flexShrink: 0,
      left: borderOffset,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
      width: size,
    }}
  />
)

class AvatarRender extends React.PureComponent<Props, State> {
  render() {
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(this.props.size)] : '50%'

    return (
      <div
        onClick={this.props.onClick}
        style={collapseStyles([
          desktopStyles.noSelect,
          {
            flexShrink: 0,
            height: this.props.size,
            position: 'relative',
            width: this.props.size,
          },
          this.props.style,
        ])}
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
