import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {NativeImage} from './native-image.native'
import type {Props, AvatarSize} from './avatar.render'

const Kb = {
  Box,
  ClickableBox,
  Icon,
  NativeImage,
}

const sizeToTeamBorderRadius = new Map<AvatarSize, number>([
  [128, 12],
  [16, 4],
  [32, 5],
  [48, 6],
  [64, 8],
  [96, 10],
])

const backgroundOffset = 1
const borderOffset = -1
const borderSize = 1
// Layer on top to extend outside of the image

const Avatar = React.memo(function Avatar(props: Props) {
  const {size} = props
  const borderRadius = (props.isTeam && sizeToTeamBorderRadius.get(size)) || size / 2
  const containerStyle = Styles.collapseStyles([boxStyles[size], props.style])

  return (
    <Kb.ClickableBox onClick={props.onClick} feedback={false} style={containerStyle}>
      <Kb.Box style={containerStyle}>
        {!props.skipBackground && (
          <Kb.Box style={[styles.background, {backgroundColor: Styles.globalColors.white, borderRadius}]} />
        )}
        {!!props.blocked && (
          <Kb.Box style={[imageStyles[props.size], {borderRadius}]}>
            <Icon type="icon-poop-96" style={iconStyles[props.size]} />
          </Kb.Box>
        )}
        {!!props.url && (
          <Kb.NativeImage
            source={props.url}
            style={[
              imageStyles[props.size],
              {
                borderRadius,
                opacity: props.opacity ? props.opacity : props.blocked ? 0.1 : 1,
              },
            ]}
          />
        )}
        {(!!props.borderColor || props.isTeam) &&
          false && ( // looks better off i think
            <Kb.Box
              style={[
                styles.borderBase,
                {borderColor: props.borderColor || Styles.globalColors.black_10, borderRadius},
              ]}
            />
          )}
        {props.followIconType && (
          <Kb.Icon
            type={props.followIconType}
            style={Styles.collapseStyles([iconStyles[props.followIconSize], props.followIconStyle])}
          />
        )}
        {props.editable && (
          <Kb.Icon
            color={props.isTeam ? Styles.globalColors.white : undefined}
            type="iconfont-edit"
            onClick={props.onEditAvatarClick}
            style={props.isTeam ? styles.editTeam : styles.edit}
          />
        )}
        {props.children}
      </Kb.Box>
    </Kb.ClickableBox>
  )
})

const makeIconStyle = (size: AvatarSize) => ({height: size, width: size})
const iconStyles = Styles.styleSheetCreate(() => ({
  [128]: makeIconStyle(128),
  [16]: makeIconStyle(16),
  [32]: makeIconStyle(32),
  [48]: makeIconStyle(48),
  [64]: makeIconStyle(64),
  [96]: makeIconStyle(96),
}))

const makeBoxStyle = (size: AvatarSize) => ({height: size, position: 'relative' as const, width: size})
const boxStyles = Styles.styleSheetCreate(() => ({
  [128]: makeBoxStyle(128),
  [16]: makeBoxStyle(16),
  [32]: makeBoxStyle(32),
  [48]: makeBoxStyle(48),
  [64]: makeBoxStyle(64),
  [96]: makeBoxStyle(96),
}))

const makeImageStyle = (size: AvatarSize) =>
  ({
    backgroundColor: Styles.globalColors.fastBlank,
    bottom: 0,
    height: size,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: size,
  } as const)
const imageStyles = Styles.styleSheetCreate(() => ({
  [128]: makeImageStyle(128),
  [16]: makeImageStyle(16),
  [32]: makeImageStyle(32),
  [48]: makeImageStyle(48),
  [64]: makeImageStyle(64),
  [96]: makeImageStyle(96),
}))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {
        bottom: backgroundOffset,
        left: backgroundOffset,
        position: 'absolute',
        right: backgroundOffset,
        top: backgroundOffset,
      },
      borderBase: {
        borderWidth: borderSize,
        bottom: borderOffset,
        left: borderOffset,
        margin: borderSize / 2,
        position: 'absolute',
        right: borderOffset,
        top: borderOffset,
      },
      edit: {
        bottom: 0,
        position: 'absolute',
        right: 0,
      },
      editTeam: {
        backgroundColor: Styles.globalColors.blue,
        borderColor: Styles.globalColors.white,
        borderRadius: 100,
        borderStyle: 'solid',
        borderWidth: 2,
        bottom: -6,
        color: Styles.globalColors.whiteOrWhite,
        padding: 4,
        position: 'absolute',
        right: -6,
      } as const,
    } as const)
)

export default Avatar
