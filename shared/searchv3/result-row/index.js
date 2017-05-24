// @flow
import * as Constants from '../../constants/searchv3'
import React from 'react'
import {Avatar, Box, Icon, ClickableBox, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {IconType} from '../../common-adapters/icon'

type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

export type Props = {|
  id: string,

  leftFollowingState: FollowingState,
  leftIcon: IconType,
  leftService: Constants.Service,
  leftUsername: string,

  rightFollowingState: FollowingState,
  rightFullname: ?string,
  rightIcon: ?IconType,
  rightService: ?Constants.Service,
  rightUsername: ?string,

  showTrackerButton: boolean,

  onShowTracker: () => void,
|}

const IconOrAvatar = ({service, username, icon, avatarSize, style}) =>
  service === 'Keybase'
    ? <Avatar username={username} size={avatarSize} style={style} />
    : icon ? <Icon type={icon} style={style} /> : null

const followingStateToStyle = (followingState: FollowingState) => {
  return {
    Following: {
      color: globalColors.green2,
    },
    NoState: {},
    NotFollowing: {
      color: globalColors.blue,
    },
    You: {
      fontStyle: 'italic',
    },
  }[followingState]
}

const Left = ({leftService, leftIcon, leftUsername, leftFollowingState}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: '100%',
        paddingLeft: globalMargins.tiny,
        width: 215,
      }}
    >
      <Box style={{...globalStyles.flexBoxCenter, width: 32}}>
        <IconOrAvatar service={leftService} username={leftUsername} icon={leftIcon} avatarSize={32} />
      </Box>
      <Text
        type="BodySemibold"
        style={{
          ...followingStateToStyle(leftFollowingState),
          marginLeft: globalMargins.small,
        }}
      >
        {leftUsername}
      </Text>
    </Box>
  )
}

const Middle = ({rightService, rightIcon, rightUsername, rightFullname, rightFollowingState}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        flex: 1,
        height: '100%',
        justifyContent: 'center',
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <IconOrAvatar
          service={rightService}
          username={rightUsername}
          icon={rightIcon}
          avatarSize={12}
          style={{
            fontSize: 12,
            height: 12,
            marginRight: 3,
            width: 12,
          }}
        />
        <Text type="BodySmallSemibold" style={followingStateToStyle(rightFollowingState)}>
          {rightUsername}
        </Text>
      </Box>
      {!!rightFullname &&
        <Box style={{...globalStyles.flexBoxRow}}>
          <Box
            style={{
              maxWidth: 15,
              minHeight: 1,
              minWidth: 15,
            }}
          />
          <Text type="BodySmall">{rightFullname}</Text>
        </Box>}
    </Box>
  )
}

const Right = ({showTrackerButton, onShowTracker}) => {
  return showTrackerButton
    ? <Icon
        type="iconfont-usercard"
        onClick={onShowTracker}
        style={{marginLeft: globalMargins.small, marginRight: globalMargins.small}}
      />
    : null
}

const Line = () => (
  <Box
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.black_05,
      left: 54,
      maxHeight: 1,
      minHeight: 1,
      top: undefined,
    }}
  />
)

const SearchResultRow = (props: Props) => {
  return (
    <ClickableBox style={_clickableBoxStyle} underlayColor={globalColors.blue4}>
      <Box style={_rowStyle}>
        <Left
          leftFollowingState={props.leftFollowingState}
          leftIcon={props.leftIcon}
          leftService={props.leftService}
          leftUsername={props.leftUsername}
        />
        <Middle
          rightFollowingState={props.rightFollowingState}
          rightFullname={props.rightFullname}
          rightIcon={props.rightIcon}
          rightService={props.rightService}
          rightUsername={props.rightUsername}
        />
        <Right showTrackerButton={props.showTrackerButton} onShowTracker={props.onShowTracker} />
        <Line />
      </Box>
    </ClickableBox>
  )
}

const _clickableBoxStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  maxHeight: globalMargins.large,
  minHeight: globalMargins.large,
  width: '100%',
}

const _rowStyle = {
  ..._clickableBoxStyle,
  alignItems: 'center',
  justifyContent: 'flex-start',
  position: 'relative',
}

export default SearchResultRow
