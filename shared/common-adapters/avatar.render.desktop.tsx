import Icon, {IconType} from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import {Props, AvatarSize} from './avatar.render'
const Kb = {
  Icon,
  IconType,
}

const avatarSizeToPoopIconType = (s: AvatarSize): IconType | null =>
  s === 128
    ? Kb.IconType.icon_poop_96
    : s === 96
    ? Kb.IconType.icon_poop_64
    : s === 64
    ? Kb.IconType.icon_poop_48
    : s === 48 || s === 32
    ? Kb.IconType.icon_poop_32
    : null

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
      {!!props.blocked && !!avatarSizeToPoopIconType(props.size) && (
        <div
          className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
          style={styles.poopContainer}
        >
          {/* ts messes up here without the || 'icon-poop-32' even though it
              can't happen due to the !!avatarSizeToPoopIconType() check above */}
          <Icon
            type={Kb.Icon.makeFastType(avatarSizeToPoopIconType(props.size) || Kb.IconType.icon_poop_32)}
          />
        </div>
      )}
      {!!props.url && (
        <div
          className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
          style={{
            backgroundImage: props.url,
            opacity:
              props.opacity === undefined || props.opacity === 1
                ? props.blocked
                  ? 0.1
                  : undefined
                : props.opacity,
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
      {props.followIconType && (
        <Icon type={Kb.Icon.makeFastType(props.followIconType)} style={props.followIconStyle} />
      )}
      {props.editable && (
        <Icon
          type={Kb.Icon.makeFastType(Kb.IconType.iconfont_edit)}
          style={props.isTeam ? styles.editTeam : styles.edit}
        />
      )}
      {props.children}
    </div>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      poopContainer: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
      },
    } as const)
)

export default Avatar
