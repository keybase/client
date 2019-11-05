import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import shallowEqual from 'shallowequal'
import memoize from 'lodash/memoize'

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor(idx: number, isLastParticipant: boolean, backgroundColor?: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

type AvatarProps = {
  participants: Array<string>
  isHovered: boolean
  isLocked: boolean
  isMuted: boolean
  isSelected: boolean
  backgroundColor?: string
}

const StrokedIcon = Styles.styled(Kb.Icon)(props => ({
  bottom: 1,
  color: props.isHovered && !props.isSelected ? Styles.globalColors.black_20 : props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_20,
  position: 'absolute',
  right: 1,
  '&.stroke': {
    '-webkit-text-stroke': `4px ${props.isHovered && !props.isSelected ? Styles.globalColors.blueGreyDark : props.isSelected ? Styles.globalColors.blue : Styles.globalColors.blueGrey}`,
    color: props.isHovered && !props.isSelected ? Styles.globalColors.blueGreyDark : props.isSelected ? Styles.globalColors.blue : Styles.globalColors.blueGrey,
    bottom: 0,
    fontWeight: 'bolder',
    right: 0,
  },
}))

const MutedIcon = (p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}): React.ReactElement<any> | null => {
  const {isHovered, isMuted, isSelected, isLocked} = p
  let type: Kb.IconType
  if (isMuted) {
    if (Styles.isMobile) {
      type = isSelected ? 'icon-shh-active-26-21' : 'icon-shh-26-21'
    } else {
      type = 'iconfont-shh'
    }
    return (<Kb.Box style={Styles.collapseStyles([avatarIconStyle, {bottom: -4, right: -2}])}>
      <StrokedIcon isSelected={isSelected} isHovered={isHovered} className="stroke" type={type} fontSize={Styles.isMobile ? 24 : 22} />
      <StrokedIcon isSelected={isSelected} isHovered={isHovered} type={type} fontSize={20} />
    </Kb.Box>)
  } else if (isLocked) {
    if (Styles.isMobile) {
      type = isSelected ? 'icon-addon-lock-active-22' : 'icon-addon-lock-22'
    } else {
      type = isSelected
        ? 'icon-addon-lock-active-16'
        : isHovered
        ? 'icon-addon-lock-hover-16'
        : 'icon-addon-lock-16'
    }
    return <Kb.Icon type={type} style={avatarIconStyle} />
  }
  return null
}

class Avatars extends React.Component<AvatarProps> {
  shouldComponentUpdate(nextProps: AvatarProps) {
    return !shallowEqual(this.props, nextProps, (_, __, key) => {
      if (key === 'participants') {
        return shallowEqual(this.props.participants, nextProps.participants)
      }

      return undefined
    })
  }

  render() {
    const {participants, isHovered, isLocked, isMuted, isSelected, backgroundColor} = this.props

    const avatarCount = Math.min(2, participants.length)
    const opacity = isLocked ? 0.4 : 1
    const avatarProps = participants.slice(0, 2).map(
      (username, idx) =>
        ({
          borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
          loadingColor: Styles.globalColors.greyLight,
          size: 32,
          skipBackground: Styles.isMobile,
          username,
        } as const)
    )

    return (
      <Kb.Box style={styles.avatarBox}>
        <Kb.Box style={styles.avatarInnerBox}>
          <Kb.MultiAvatar
            singleSize={48}
            multiSize={32}
            avatarProps={avatarProps}
            multiPadding={Styles.isMobile ? 2 : 0}
            style={opacity === 1 ? multiStyle(backgroundColor) : {...multiStyle(backgroundColor), opacity}}
          />
          <MutedIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
        </Kb.Box>
      </Kb.Box>
    )
  }
}

const multiStyle = memoize(backgroundColor => {
  return {
    ...(Styles.isMobile ? {backgroundColor, paddingBottom: 10, paddingTop: 10} : {}),
    height: 48,
    width: 48,
  }
})

const styles = Styles.styleSheetCreate(() => ({
  avatarBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    height: 48,
    justifyContent: 'flex-start',
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    maxWidth: 48,
    minWidth: 48,
    position: 'relative',
  },
  avatarInnerBox: {
    height: 48,
    maxWidth: 48,
    minWidth: 48,
    position: 'relative',
  },
}))

class TeamAvatar extends React.Component<{
  teamname: string
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
}> {
  render() {
    return (
      <Kb.Box style={styles.avatarBox}>
        <Kb.Avatar teamname={this.props.teamname} size={48} />
        <MutedIcon
          isSelected={this.props.isSelected}
          isMuted={this.props.isMuted}
          isHovered={this.props.isHovered}
          isLocked={false}
        />
      </Kb.Box>
    )
  }
}

const offset = Styles.isMobile ? -1 : 0
const avatarIconStyle = {
  bottom: offset,
  position: 'absolute',
  right: offset,
} as const

export {Avatars, TeamAvatar}
