// @flow
import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
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
  '128': 16,
  '16': 4,
  '32': 6,
  '48': 8,
  '64': 10,
  '96': 12,
}

// The background is a separate layer due to a chrome bug where if you keep it as a background of an img (for example) it'll bleed the edges
const Background = ({borderRadius}) => (
  <div className="avatar-background" style={borderRadius ? {borderRadius} : null} />
)

// The actual image
class UserImage extends React.PureComponent<ImageProps> {
  render() {
    const {opacity = 1, url, borderRadius, size} = this.props
    const style = {
      backgroundImage: url,
      borderRadius,
      height: size,
      opacity,
      width: size,
    }
    return <div className="avatar-user-image" style={style} />
  }
}

// Layer on top to extend outside of the image
const Border = ({borderColor, isTeam, size, borderRadius}) => {
  const style = {
    borderRadius,
    boxShadow: `0px 0px 0px ${isTeam ? 1 : 2}px ${
      !borderColor ? (isTeam ? Styles.globalColors.black_10 : '') : borderColor
    } ${isTeam ? 'inset' : ''}`,
    width: size,
  }
  return <div className={isTeam ? 'avatar-border-team' : 'avatar-border'} style={style} />
}

class AvatarRender extends React.PureComponent<Props, State> {
  render() {
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(this.props.size)] : '50%'

    return (
      <div
        className="avatar"
        onClick={this.props.onClick}
        style={Styles.collapseStyles([
          {
            height: this.props.size,
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
        {(!!this.props.borderColor || this.props.isTeam) && (
          <Border
            isTeam={this.props.isTeam}
            borderColor={this.props.borderColor || Styles.globalColors.black_10}
            size={this.props.size}
            borderRadius={borderRadius}
          />
        )}
        {this.props.followIconType && (
          <Icon type={this.props.followIconType} style={this.props.followIconStyle} />
        )}
        {this.props.editable && (
          <Icon
            type="iconfont-edit"
            style={{
              bottom: this.props.isTeam ? -2 : 0,
              position: 'absolute',
              right: this.props.isTeam ? -18 : 0,
            }}
          />
        )}
        {this.props.children}
      </div>
    )
  }
}

export default AvatarRender
