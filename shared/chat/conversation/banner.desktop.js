// @flow

import React from 'react'
import {Box, Icon, Text, Header as CommonHeader} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props, ErrorVariant, InviteVariant} from './banner'

const ErrorBanner = (props: ErrorVariant) => {
  return (
    <CommonHeader windowDragging={false} style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.red}} type='Strong'>
      <Text type='Header' backgroundMode='Announcements' style={{flex: 1, ...globalStyles.flexBoxCenter, paddingTop: 6}}>{props.text}</Text>
      <Text type='HeaderLink' backgroundMode='Announcements' onClick={props.textLinkOnClick} style={{textAlign: 'center'}}>
        {props.textLink}
      </Text>
    </CommonHeader>
  )
}

const InviteBanner = (props: InviteVariant) => {
  return (
    <CommonHeader windowDragging={false} style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.blue}} type='Strong'>
      <Text type='Header' backgroundMode='Announcements' style={{flex: 1, ...globalStyles.flexBoxCenter, paddingTop: 6, cursor: 'default'}}>Your messages to {props.username} will unlock when they join Keybase. You can give them this invite link:</Text>
      <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'flex-end'}}>
        <Icon onClick={props.onClickInviteLink} type='iconfont-link' style={{fontSize: 16, color: globalColors.white_40, marginRight: globalMargins.tiny}} />
        <Text type='HeaderLink' backgroundMode='Announcements' onClick={props.onClickInviteLink}>
          {props.inviteLink}
        </Text>
      </Box>
    </CommonHeader>
  )
}

const Banner = (props: Props) => {
  if (props.type === 'Error') {
    return <ErrorBanner {...props} />
  } else if (props.type === 'Invite') {
    return <InviteBanner {...props} />
  }

  return <CommonHeader windowDragging={false} style={{backgroundColor: globalColors.blue}} type='Strong' title={props.text} />
}

export default Banner
