import * as Kb from '@/common-adapters'
import './chat.css'

const OverlayIcon = function OverlayIcon(p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}) {
  const {isHovered, isMuted, isSelected, isLocked} = p

  if (Kb.Styles.isMobile) {
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
    <Kb.Box2 direction="vertical" style={styles.mutedIcon}>
      <Kb.Icon
        className={Kb.Styles.classNames('overlay-icon', 'stroked', {
          hovered: isHovered,
          locked: isLocked,
          muted: isMuted,
          selected: isSelected,
        })}
        type={type}
        fontSize={18}
      />
      <Kb.Icon
        className={Kb.Styles.classNames('overlay-icon', {
          hovered: isHovered,
          locked: isLocked,
          muted: isMuted,
          selected: isSelected,
        })}
        type={type}
        fontSize={16}
      />
    </Kb.Box2>
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
  singleSize?: 128 | 96 | 64 | 48 | 32 | 24 | 16
}

const Avatars = function Avatars(p: Props) {
  const {participantOne, participantTwo, backgroundColor} = p
  const {singleSize = 48} = p
  const {isHovered = false} = p
  const {isLocked = false} = p
  const {isMuted = false} = p
  const {isSelected = false} = p
  const opacity = isLocked ? 0.4 : 1

  const leftStyle = {left: 0, position: 'absolute', top: 0} as const
  const rightStyle = Kb.Styles.collapseStyles([
    {bottom: 0, position: 'absolute', right: 0} as const,
    !Kb.Styles.isMobile && backgroundColor && {borderRadius: '50%', boxShadow: `0px 0px 0px 2px ${backgroundColor}`},
  ])

  const containerStyle = Kb.Styles.collapseStyles([styles.container, {height: singleSize, width: singleSize}])

  if (!participantTwo) {
    return (
      <Kb.Box2 direction="vertical" relative={true} style={containerStyle}>
        <Kb.Box2 direction="vertical" relative={true}>
          <Kb.Avatar username={participantOne} size={singleSize} style={{opacity}} />
          <OverlayIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" relative={true} style={containerStyle}>
      <Kb.Avatar username={participantTwo} size={32} style={leftStyle} />
      <Kb.Avatar username={participantOne} size={32} style={rightStyle} />
      <OverlayIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    flexShrink: 0,
    justifyContent: 'flex-start',
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  mutedIcon: Kb.Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {bottom: -3, right: -1},
    isMobile: {bottom: -1, right: -1},
  }),
}))

const TeamAvatar = function TeamAvatar(p: {
  teamname: string
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  size?: 128 | 96 | 64 | 48 | 32 | 24 | 16
}) {
  const {teamname, size, isSelected, isMuted, isHovered} = p
  return (
    <Kb.Box2 direction="vertical" relative={true} style={styles.container}>
      <Kb.Avatar teamname={teamname} size={size || 48} />
      <OverlayIcon isSelected={isSelected} isMuted={isMuted} isHovered={isHovered} isLocked={false} />
    </Kb.Box2>
  )
}

export {Avatars, TeamAvatar}
