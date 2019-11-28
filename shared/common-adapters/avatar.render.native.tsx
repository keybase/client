import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {NativeImage} from './native-image.native'
import {Props} from './avatar.render'

const Kb = {
  Box,
  ClickableBox,
  Icon,
  NativeImage,
}

const sizeToTeamBorderRadius = {
  '12': 2,
  '128': 12,
  '16': 4,
  '32': 5,
  '48': 6,
  '64': 8,
  '96': 10,
}

const backgroundOffset = 1
const borderOffset = -1
const borderSize = 1
// Layer on top to extend outside of the image

const Avatar = (props: Props) => {
  const {size} = props
  const borderRadius: number = props.isTeam ? sizeToTeamBorderRadius[String(size)] : size / 2
  const containerStyle = Styles.collapseStyles([styles[`box:${size}`], props.style])

  return (
    <Kb.ClickableBox onClick={props.onClick} feedback={false} style={containerStyle}>
      <Kb.Box style={containerStyle}>
        {!props.skipBackground && (
          <Kb.Box style={[styles.background, {backgroundColor: Styles.globalColors.white, borderRadius}]} />
        )}
        {!!props.blocked && (
          <Kb.Box style={[styles[`image:${props.size}`], {borderRadius}]}>
            <Icon type="icon-poop-96" style={[styles[`icon:${props.size}`], styles.poop]} />
          </Kb.Box>
        )}
        {!!props.url && (
          <Kb.NativeImage
            source={props.url}
            style={[
              styles[`image:${props.size}`],
              {
                borderRadius,
                opacity: props.opacity ? props.opacity : props.blocked && 0.1,
              },
            ]}
          />
        )}
        {(!!props.borderColor || props.isTeam) && (
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
            style={Styles.collapseStyles([styles[`icon:${props.followIconSize}`], props.followIconStyle])}
          />
        )}
        {props.editable && (
          <Kb.Icon
            type="iconfont-edit"
            onClick={props.onEditAvatarClick}
            style={props.isTeam ? styles.editTeam : styles.edit}
          />
        )}
        {props.children}
      </Kb.Box>
    </Kb.ClickableBox>
  )
}

const sizes = [128, 96, 64, 48, 32, 16, 12]

const iconStyles = sizes.reduce((map, size) => {
  map[`icon:${size}`] = {height: size, width: size}
  return map
}, {})

const boxStyles = sizes.reduce((map, size) => {
  map[`box:${size}`] = {height: size, position: 'relative', width: size}
  return map
}, {})

const imageStyles = sizes.reduce((map, size) => {
  map[`image:${size}`] = {
    backgroundColor: Styles.globalColors.fastBlank,
    bottom: 0,
    height: size,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: size,
  }
  return map
}, {})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      ...boxStyles,
      ...iconStyles,
      ...imageStyles,
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
        bottom: -2,
        position: 'absolute',
        right: -28,
      },
    } as const)
)

export default Avatar
