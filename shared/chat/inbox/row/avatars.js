// @flow
import * as React from 'react'
import shallowEqual from 'shallowequal'
import {Avatar, MultiAvatar, Icon, Box} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../styles'
import {memoize} from 'lodash-es'

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor(idx: number, isLastParticipant: boolean, backgroundColor: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

type AvatarProps = {
  participants: Array<string>,
  isHovered: boolean,
  isLocked: boolean,
  isMuted: boolean,
  isSelected: boolean,
  backgroundColor: string,
}

const MutedIcon = ({isHovered, isMuted, isSelected, isLocked}) => {
  let icon = null
  let type
  if (isMuted) {
    if (isMobile) {
      type = isSelected ? 'icon-shh-active-24' : 'icon-shh-24'
    } else {
      type = isSelected ? 'icon-shh-active-16' : isHovered ? 'icon-shh-hover-16' : 'icon-shh-16'
    }
    icon = <Icon type={type} style={avatarIconStyle} />
  } else if (isLocked) {
    if (isMobile) {
      type = isSelected ? 'icon-addon-lock-active-22' : 'icon-addon-lock-22'
    } else {
      type = isSelected
        ? 'icon-addon-lock-active-16'
        : isHovered
          ? 'icon-addon-lock-hover-16'
          : 'icon-addon-lock-16'
    }
    icon = <Icon type={type} style={avatarIconStyle} />
  }
  return icon
}

class Avatars extends React.Component<AvatarProps> {
  shouldComponentUpdate(nextProps: AvatarProps) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
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
    const avatarProps = participants.slice(0, 2).map((username, idx) => ({
      borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
      loadingColor: globalColors.lightGrey,
      size: 32,
      skipBackground: isMobile,
      skipBackgroundAfterLoaded: isMobile,
      username,
    }))

    return (
      <Box style={avatarBoxStyle}>
        <Box style={avatarInnerBoxStyle}>
          <MultiAvatar
            singleSize={48}
            multiSize={32}
            avatarProps={avatarProps}
            multiPadding={isMobile ? 2 : 0}
            style={opacity === 1 ? multiStyle(backgroundColor) : {...multiStyle(backgroundColor), opacity}}
          />
          <MutedIcon isHovered={isHovered} isSelected={isSelected} isMuted={isMuted} isLocked={isLocked} />
        </Box>
      </Box>
    )
  }
}

const multiStyle = memoize(backgroundColor => {
  return {
    ...(isMobile ? {paddingBottom: 10, paddingTop: 10, backgroundColor} : {}),
    height: 48,
    width: 48,
  }
})

const avatarBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 48,
  justifyContent: 'flex-start',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  maxWidth: 48,
  minWidth: 48,
  position: 'relative',
}

const avatarInnerBoxStyle = {
  height: 48,
  maxWidth: 48,
  minWidth: 48,
  position: 'relative',
}

class TeamAvatar extends React.Component<{
  teamname: string,
  isHovered: boolean,
  isMuted: boolean,
  isSelected: boolean,
}> {
  render() {
    return (
      <Box style={avatarBoxStyle}>
        <Avatar teamname={this.props.teamname} size={48} />
        <MutedIcon
          isSelected={this.props.isSelected}
          isMuted={this.props.isMuted}
          isHovered={this.props.isHovered}
          isLocked={false}
        />
      </Box>
    )
  }
}

const avatarIconStyle = {
  bottom: 0,
  position: 'absolute',
  right: 0,
}

export {Avatars, TeamAvatar}
