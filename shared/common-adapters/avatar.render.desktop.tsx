import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './avatar.render'

const Avatar = (props: Props) => {
  const avatarSizeClasName = `avatar-${props.isTeam ? 'team' : 'user'}-size-${props.size}`
  return (
    <div
      className={Styles.classNames('avatar', avatarSizeClasName)}
      onClick={props.onClick}
      style={Styles.collapseStyles([props.style, props.onClick && styles.clickable])}
    >
      {!props.skipBackground && (
        <div className={Styles.classNames('avatar-background', avatarSizeClasName)} />
      )}
      {!!props.url && (
        <div
          className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
          style={{
            backgroundImage: props.url,
            opacity: props.opacity === undefined || props.opacity === 1 ? undefined : props.opacity,
          }}
        />
      )}
      {(!!props.borderColor || props.isTeam) && (
        <div
          style={Styles.collapseStyles([
            props.isTeam ? styles.borderTeam : styles.border,
            props.borderColor && {
              boxShadow: `0px 0px 0px ${props.isTeam ? 1 : 2}px ${props.borderColor ||
                Styles.globalColors.black_10} ${props.isTeam ? 'inset' : ''}`,
            },
          ])}
          className={Styles.classNames(
            {'avatar-border': !props.isTeam, 'avatar-border-team': props.isTeam},
            avatarSizeClasName
          )}
        />
      )}
      {props.followIconType && <Icon type={props.followIconType} style={props.followIconStyle} />}
      {props.editable && <Icon type="iconfont-edit" style={props.isTeam ? styles.editTeam : styles.edit} />}
      {props.children}
    </div>
  )
}

const styles = Styles.styleSheetCreate({
  border: Styles.platformStyles({
    isElectron: {boxShadow: `0px 0px 0px 2px ${Styles.globalColors.black_10}}`},
  }),
  borderTeam: Styles.platformStyles({
    isElectron: {boxShadow: `0px 0px 0px 1px ${Styles.globalColors.black_10} inset`},
  }),
  clickable: Styles.platformStyles({isElectron: {...Styles.desktopStyles.clickable}}),
  edit: {
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
  editTeam: {
    bottom: -2,
    position: 'absolute',
    right: -18,
  },
})

export default Avatar
