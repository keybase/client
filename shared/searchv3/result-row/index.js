// @flow
import * as Constants from '../../constants/searchv3'
import React, {Component} from 'react'
import {Avatar, Box, Icon, ClickableBox, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {IconType} from '../../common-adapters/icon'

type KeybaseUsername = string
type SearchIcon = IconType | KeybaseUsername // if service is Keybase its a username

export type Props = {|
  id: string,

  leftFollowing: boolean,
  leftIcon: SearchIcon,
  leftService: Constants.Service,
  leftUsername: string,

  rightFullname: ?string,
  rightIcon: ?SearchIcon,
  rightService: ?Constants.Service,
  rightUsername: ?string,

  showTrackerButton: boolean,

  onShowTracker: () => void,
|}

const IconOrAvatar = ({service, username, icon, size, style}) =>
  service === 'Keybase'
    ? <Avatar username={username} size={size} style={style} />
    : icon ? <Icon type={icon} style={style} /> : null

const Left = ({leftService, leftIcon, leftUsername, leftFollowing}) => {
  return (
    <Box style={_leftContainerStyle}>
      <IconOrAvatar service={leftService} username={leftUsername} icon={leftIcon} size={32} />
      <Text type="BodySemibold" style={{marginLeft: globalMargins.small}}>{leftUsername}</Text>
    </Box>
  )
}

const _leftContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: '100%',
  paddingLeft: globalMargins.tiny,
  width: 215,
}

const Middle = ({rightService, rightIcon, rightUsername, rightFullname}) => {
  return (
    <Box style={_middleContainerStyle}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <IconOrAvatar
          service={rightService}
          username={rightUsername}
          icon={rightIcon}
          size={12}
          style={{
            fontSize: 12,
            height: 12,
            marginRight: 3,
            width: 12,
          }}
        />
        <Text type="BodySmall">{rightUsername}</Text>
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

const _middleContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  height: '100%',
}

const Right = ({showTrackerButton, onShowTracker}) => {
  return showTrackerButton ? <Icon type="iconfont-usercard" onClick={onShowTracker} /> : null
}

const Line = () => (
  <Box
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.black_05,
      left: 56,
      maxHeight: 1,
      minHeight: 1,
      top: undefined,
    }}
  />
)

const SearchResultRow = (props: Props) => {
  return (
    <Box style={_rowStyle}>
      <Left
        leftFollowing={props.leftFollowing}
        leftIcon={props.leftIcon}
        leftService={props.leftService}
        leftUsername={props.leftUsername}
      />
      <Middle
        rightFullname={props.rightFullname}
        rightIcon={props.rightIcon}
        rightService={props.rightService}
        rightUsername={props.rightUsername}
      />
      <Right showTrackerButton={props.showTrackerButton} onShowTracker={props.onShowTracker} />
      <Line />
    </Box>
  )
}

const _rowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-start',
  maxHeight: globalMargins.large,
  minHeight: globalMargins.large,
  position: 'relative',
}

export default SearchResultRow
