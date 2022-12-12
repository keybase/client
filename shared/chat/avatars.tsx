import * as React from 'react'
import * as Kb from '../common-adapters'
import type {Props as IconProps} from '../common-adapters/icon'
import type {AvatarSize} from '../common-adapters/avatar'
import * as Styles from '../styles'
import './chat.css'

type AvatarProps = {
  participantOne?: string
  participantTwo?: string
  isHovered: boolean
  isLocked: boolean
  isMuted: boolean
  isSelected: boolean
  backgroundColor?: string
  singleSize?: AvatarSize
}

const MobileMutedIcon = (p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}): React.ReactElement | null => {
  const {isMuted, isSelected, isLocked} = p
  const type = isMuted
    ? isSelected
      ? 'icon-shh-active-26-21'
      : 'icon-shh-26-21'
    : isLocked
    ? isSelected
      ? 'icon-addon-lock-active-22'
      : 'icon-addon-lock-22'
    : null
  return type ? <Kb.Icon type={type} style={styles.mutedIcon} /> : null
}

type StrokedIconProps = IconProps & {
  isHovered: boolean
  isSelected: boolean
}
const StrokedIcon = Styles.styled(Kb.Icon)((props: StrokedIconProps) => ({
  '&.stroke': {
    WebkitTextStroke: `3px ${
      props.isHovered && !props.isSelected
        ? Styles.globalColors.blueGreyDark
        : props.isSelected
        ? Styles.globalColors.blue
        : Styles.globalColors.blueGrey
    }`,
    bottom: 0,
    color:
      props.isHovered && !props.isSelected
        ? Styles.globalColors.blueGreyDark
        : props.isSelected
        ? Styles.globalColors.blue
        : Styles.globalColors.blueGrey,
    right: 0,
  },
  bottom: 1,
  color:
    props.isHovered && !props.isSelected
      ? Styles.globalColors.black_20
      : props.isSelected
      ? Styles.globalColors.white
      : Styles.globalColors.black_20,
  position: 'absolute',
  right: 1,
}))

// const noTheme = {}
const DesktopMutedIcon = (p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}): React.ReactElement | null => {
  const {isHovered, isMuted, isSelected, isLocked} = p
  const type = isMuted ? 'iconfont-shh' : isLocked ? 'iconfont-lock' : null
  return type ? (
    <Kb.Box style={styles.mutedIcon}>
      <Kb.Icon
        className={Styles.classNames('stroke', {
          hoverd: isHovered,
          locked: isLocked,
          muted: isMuted,
          selected: isSelected,
        })}
        type={type}
        fontSize={18}
      />
    </Kb.Box>
  ) : null
}
// <Kb.Icon isSelected={isSelected} isHovered={isHovered} type={type} fontSize={16} theme={noTheme} />

const MutedIcon = Styles.isMobile ? MobileMutedIcon : DesktopMutedIcon

const Avatars = React.memo(function Avatars(p: AvatarProps) {
  const {participantOne, participantTwo, backgroundColor} = p
  const singleSize = p.singleSize ?? 48
  const {isHovered, isLocked, isMuted, isSelected} = p
  const opacity = isLocked ? 0.4 : 1

  const leftProps = {
    loadingColor: Styles.globalColors.greyLight,
    size: 32,
    skipBackground: Styles.isMobile,
    style: {left: 0, position: 'absolute', top: 0},
    username: participantTwo,
  } as const

  const rightProps = {
    borderColor: backgroundColor,
    loadingColor: Styles.globalColors.greyLight,
    size: 32,
    skipBackground: Styles.isMobile,
    style: {bottom: 0, position: 'absolute', right: 0},
    username: participantOne,
  } as const

  const containerStyle = Styles.collapseStyles([styles.container, {height: singleSize, width: singleSize}])

  if (!participantTwo) {
    return (
      <Kb.Box style={containerStyle}>
        <Kb.Box style={styles.outerBox}>
          <Kb.Avatar username={participantOne} size={singleSize || 48} style={{backgroundColor, opacity}} />
          <MutedIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
        </Kb.Box>
      </Kb.Box>
    )
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={containerStyle}>
      <Kb.Avatar {...leftProps} />
      <Kb.Avatar {...rightProps} />
      <MutedIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: {
    flexShrink: 0,
    justifyContent: 'flex-start',
    marginRight: Styles.globalMargins.tiny,
    position: 'relative',
  },
  mutedIcon: Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {bottom: -3, right: -1},
    isMobile: {bottom: -1, right: -1},
  }),
  outerBox: {position: 'relative'},
}))

const TeamAvatar = React.memo(function TeamAvatar(p: {
  teamname: string
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  size?: AvatarSize
}) {
  const {teamname, size, isSelected, isMuted, isHovered} = p
  return (
    <Kb.Box style={styles.container}>
      <Kb.Avatar teamname={teamname} size={size || 48} />
      <MutedIcon isSelected={isSelected} isMuted={isMuted} isHovered={isHovered} isLocked={false} />
    </Kb.Box>
  )
})

export {Avatars, TeamAvatar}
