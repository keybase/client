import * as React from 'react'
import * as Kb from '../common-adapters'
import type {AvatarSize} from '../common-adapters/avatar'
import * as Styles from '../styles'
import './chat.css'

const OverlayIcon = (p: {isHovered: boolean; isMuted: boolean; isSelected: boolean; isLocked: boolean}) => {
  const {isHovered, isMuted, isSelected, isLocked} = p

  if (Styles.isMobile) {
    const type = isMuted
      ? isSelected
        ? 'icon-shh-active-26-21'
        : 'icon-shh-26-21'
      : isLocked
      ? isSelected
        ? 'icon-addon-lock-active-22'
        : 'icon-addon-lock-22'
      : null
    if (!type) return null
    return <Kb.Icon type={type} style={styles.mutedIcon} />
  }
  const type = isMuted ? 'iconfont-shh' : isLocked ? 'iconfont-lock' : null
  if (!type) return null

  return (
    <Kb.Box style={styles.mutedIcon}>
      <Kb.Icon
        className={Styles.classNames('overlay-icon', 'stroked', {
          hovered: isHovered,
          locked: isLocked,
          muted: isMuted,
          selected: isSelected,
        })}
        type={type}
        fontSize={18}
      />
      <Kb.Icon
        className={Styles.classNames('overlay-icon', {
          hovered: isHovered,
          locked: isLocked,
          muted: isMuted,
          selected: isSelected,
        })}
        type={type}
        fontSize={16}
      />
    </Kb.Box>
  )
}

type Props = {
  participantOne?: string
  participantTwo?: string
  isHovered?: boolean
  isLocked?: boolean
  isMuted?: boolean
  isSelected?: boolean
  backgroundColor?: string
  singleSize?: AvatarSize
}

const Avatars = React.memo(function Avatars(p: Props) {
  const {participantOne, participantTwo, backgroundColor} = p
  const {singleSize = 48} = p
  const {isHovered = false} = p
  const {isLocked = false} = p
  const {isMuted = false} = p
  const {isSelected = false} = p
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
          <OverlayIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
        </Kb.Box>
      </Kb.Box>
    )
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={containerStyle}>
      <Kb.Avatar {...leftProps} />
      <Kb.Avatar {...rightProps} />
      <OverlayIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
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
      <OverlayIcon isSelected={isSelected} isMuted={isMuted} isHovered={isHovered} isLocked={false} />
    </Kb.Box>
  )
})

export {Avatars, TeamAvatar}
