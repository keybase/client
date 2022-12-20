import Icon, {type IconType} from './icon'
import * as Styles from '../styles'
import type {Props, AvatarSize} from './avatar.render'
import {AVATAR_SIZE} from '../common-adapters/avatar'

const avatarSizeToPoopIconType = (s: AvatarSize): IconType | null =>
  s === 128
    ? 'icon-poop-96'
    : s === 96
    ? 'icon-poop-64'
    : s === 64
    ? 'icon-poop-48'
    : s === 48 || s === 32
    ? 'icon-poop-32'
    : null

const Avatar = (props: Props) => {
  const avatarSizeClasName = `avatar-${props.isTeam ? 'team' : 'user'}-size-${props.size}`

  const scaledAvatarRatio = props.size / AVATAR_SIZE
  const avatarScaledWidth =
    props.crop && props.crop.scaledWidth ? props.crop.scaledWidth * scaledAvatarRatio : null

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
          <Icon type={avatarSizeToPoopIconType(props.size) || 'icon-poop-32'} />
        </div>
      )}
      {!!props.url && props.crop == undefined && (
        <div
          className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
          style={{
            backgroundImage: props.url,
            opacity:
              props.opacity === undefined || props.opacity === 1
                ? props.blocked
                  ? 1
                  : undefined
                : props.opacity,
          }}
        />
      )}
      {!!props.url &&
        props.crop &&
        props.crop?.offsetLeft !== undefined &&
        props.crop?.offsetTop !== undefined && (
          <img
            className={Styles.classNames('avatar-user-image', avatarSizeClasName)}
            style={{
              backgroundImage: props.url,
              backgroundPositionX: props.crop?.offsetLeft * scaledAvatarRatio,
              backgroundPositionY: props.crop?.offsetTop * scaledAvatarRatio,
              backgroundSize: `${avatarScaledWidth}px auto`,
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
            props.isTeam && styles.borderTeam,
            !props.isTeam && styles.border,
            props.borderColor &&
              ({
                boxShadow: `0px 0px 0px ${props.isTeam ? 1 : 2}px ${
                  props.borderColor || Styles.globalColors.black_10
                } ${props.isTeam ? 'inset' : ''}`,
              } as const),
          ] as any)}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      border: Styles.platformStyles({
        isElectron: {boxShadow: `0px 0px 0px 2px ${Styles.globalColors.black_10}}`},
      } as const),
      borderTeam: Styles.platformStyles({
        isElectron: {boxShadow: `0px 0px 0px 1px ${Styles.globalColors.black_10} inset`},
      } as const),
      clickable: Styles.platformStyles({isElectron: {...Styles.desktopStyles.clickable}} as const),
      edit: {
        bottom: 0,
        position: 'absolute',
        right: 0,
      },
      editTeam: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.blue,
          border: 'solid white 2px',
          borderRadius: 100,
          bottom: -6,
          color: Styles.globalColors.whiteOrWhite,
          padding: 4,
          position: 'absolute',
          right: -6,
        },
      }),
      editTeamOld: {
        bottom: -2,
        position: 'absolute',
        right: -18,
      },
      poopContainer: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1,
      },
    } as const)
)

export default Avatar
