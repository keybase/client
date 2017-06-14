// @flow
import * as Constants from '../../constants/searchv3'
import React from 'react'
import {Box, Icon, ClickableBox, Text} from '../../common-adapters/index'
import {globalColors, globalStyles, globalMargins, hairlineWidth} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {isMobile} from '../../constants/platform'

const Left = ({leftService, leftIcon, leftUsername, leftFollowingState}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: '100%',
        paddingLeft: globalMargins.tiny,
        // TODO we might want to change this for the mobile version. Will play around with it more
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
        {!!rightUsername &&
          <Text type="BodySmallSemibold" style={followingStateToStyle(rightFollowingState)}>
            {rightUsername}
          </Text>}
      </Box>
      {!!rightFullname &&
        <Box style={globalStyles.flexBoxRow}>
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
      top: undefined,
      maxHeight: hairlineWidth,
      minHeight: hairlineWidth,
    }}
  />
)

const SearchResultRow = (props: Constants.RowProps) => {
  return (
    <ClickableBox style={_clickableBoxStyle} underlayColor={globalColors.blue4} onClick={props.onClick}>
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
  ...(isMobile
    ? {
        minHeight: 56,
      }
    : {}),
}

export default SearchResultRow
