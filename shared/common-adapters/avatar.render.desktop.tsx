import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './avatar.render'

class AvatarRender extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.name !== prevProps.name) {
      this.props.load && this.props.load()
    }
  }
  componentDidMount() {
    this.props.load && this.props.load()
  }
  render() {
    const avatarSizeClasName = `avatar-${this.props.isTeam ? 'team' : 'user'}-size-${this.props.size}`

    return (
      <div
        className={Styles.classNames('avatar', avatarSizeClasName)}
        onClick={this.props.onClick}
        style={(this.props.style as unknown) as React.CSSProperties}
      >
        {!this.props.skipBackground && (
          <div className={Styles.classNames('avatar-background', avatarSizeClasName)} />
        )}
        {!!this.props.url && (
          <div
            className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
            style={{
              backgroundImage: this.props.url,
              opacity:
                this.props.opacity === undefined || this.props.opacity === 1 ? undefined : this.props.opacity,
            }}
          />
        )}
        {(!!this.props.borderColor || this.props.isTeam) && (
          <div
            style={{
              boxShadow: `0px 0px 0px ${this.props.isTeam ? 1 : 2}px ${this.props.borderColor ||
                Styles.globalColors.black_10} ${this.props.isTeam ? 'inset' : ''}`,
            }}
            className={Styles.classNames(
              {
                'avatar-border': !this.props.isTeam,
                'avatar-border-team': this.props.isTeam,
              },
              avatarSizeClasName
            )}
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
