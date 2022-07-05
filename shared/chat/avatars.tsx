import * as React from 'react'
import * as Kb from '../common-adapters'
import {Props as IconProps} from '../common-adapters/icon'
import {AvatarSize} from '../common-adapters/avatar'
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
  participants: Array<string> | string
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
}): React.ReactElement<any> | null => {
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
const StrokedIcon = Styles.styled<typeof Kb.Icon, StrokedIconProps>(Kb.Icon)(props => ({
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

const noTheme = {}
const DesktopMutedIcon = (p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}): React.ReactElement<any> | null => {
  const {isHovered, isMuted, isSelected, isLocked} = p
  const type = isMuted ? 'iconfont-shh' : isLocked ? 'iconfont-lock' : null
  return type ? (
    <Kb.Box style={styles.mutedIcon}>
      <StrokedIcon
        isSelected={isSelected}
        isHovered={isHovered}
        className="stroke"
        type={type}
        fontSize={18}
        theme={noTheme}
      />
      <StrokedIcon isSelected={isSelected} isHovered={isHovered} type={type} fontSize={16} theme={noTheme} />
    </Kb.Box>
  ) : null
}

const MutedIcon = (p: {
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  isLocked: boolean
}): React.ReactElement<any> | null => {
  return Styles.isMobile ? MobileMutedIcon(p) : DesktopMutedIcon(p)
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
    const {participants, isHovered, isLocked, isMuted, isSelected, backgroundColor, singleSize} = this.props

    const participantsArray = typeof participants === 'string' ? [participants] : participants

    const avatarCount = Math.min(2, participantsArray.length)
    const opacity = isLocked ? 0.4 : 1
    const avatarProps = participantsArray.slice(0, 2).map(
      (username, idx) =>
        ({
          borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
          loadingColor: Styles.globalColors.greyLight,
          size: singleSize || 32,
          skipBackground: Styles.isMobile,
          username,
        } as const)
    )

    return (
      <Kb.Box style={styles.avatarBox}>
        <Kb.Box style={styles.avatarInnerBox}>
          <Kb.MultiAvatar
            singleSize={singleSize || 48}
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
    justifyContent: 'flex-start',
    marginRight: Styles.globalMargins.tiny,
    position: 'relative',
  },
  avatarInnerBox: {
    position: 'relative',
  },
  mutedIcon: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      bottom: -3,
      right: -1,
    },
    isMobile: {
      bottom: -1,
      right: -1,
    },
  }),
}))

class TeamAvatar extends React.Component<{
  teamname: string
  isHovered: boolean
  isMuted: boolean
  isSelected: boolean
  size?: AvatarSize
}> {
  render() {
    return (
      <Kb.Box style={styles.avatarBox}>
        <Kb.Avatar teamname={this.props.teamname} size={this.props.size || 48} />
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

export {Avatars, TeamAvatar}
