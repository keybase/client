// @flow
import React from 'react'
import {Box, Icon, Text, Header as CommonHeader} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {intersperseFn} from '../../util/arrays'

import type {Props, ErrorVariant, InviteVariant, BrokenTrackerVariant} from './banner'

const brokenStyle = {
  display: 'inline-block',
}

const commonHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.red,
  padding: 6,
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'wrap',
}

function brokenSeparator (idx, item, arr) {
  if (idx === arr.length) {
    return null
  } else if (idx === arr.length - 1) {
    return <BannerText key={idx} style={brokenStyle}>,&nbsp;and&nbsp;</BannerText>
  } else {
    return <BannerText key={idx} style={brokenStyle}>,&nbsp;</BannerText>
  }
}

const Header = ({children, title, style}) => (
  <CommonHeader windowDragging={false} style={{...commonHeaderStyle, ...style}} type='Strong' title={title}>{children}</CommonHeader>
)

const BannerText = (props) => (
  <Text type='BodySemibold' backgroundMode='Announcements' {...props} />
)

const BrokenTrackerBanner = (props: BrokenTrackerVariant) => {
  if (props.users.length === 1) {
    const user = props.users[0]
    return (
      <Header style={globalStyles.flexBoxRow}>
        <BannerText style={brokenStyle}>Some of&nbsp;</BannerText>
        <BannerText type='BodySemiboldLink' style={brokenStyle} onClick={() => props.onClick(user)}>{user}</BannerText>
        <BannerText style={brokenStyle}>'s proofs have changed since you last followed them.</BannerText>
      </Header>
    )
  } else {
    return (
      <Header style={globalStyles.flexBoxRow}>
        {intersperseFn(brokenSeparator, props.users.map((user, idx) => (
          <BannerText type='BodySemiboldLink' key={user} style={brokenStyle} onClick={() => props.onClick(user)}>{user}</BannerText>
        )))}
        <BannerText style={brokenStyle}>&nbsp;have changed their proofs since you last followed them.</BannerText>
      </Header>
    )
  }
}

const ErrorBanner = (props: ErrorVariant) => {
  return (
    <Header>
      <BannerText style={{flex: 1, ...globalStyles.flexBoxCenter}}>{props.text}</BannerText>
      <BannerText type='BodySemiboldLink' onClick={props.textLinkOnClick} style={{textAlign: 'center'}}>
        {props.textLink}
      </BannerText>
    </Header>
  )
}

const InviteBanner = (props: InviteVariant) => {
  return (
    <Header style={{backgroundColor: globalColors.blue}}>
      <BannerText backgroundMode='Announcements' style={{flex: 1, ...globalStyles.flexBoxCenter}}>Your messages to {props.username} will unlock when they join Keybase.</BannerText>
      <BannerText backgroundMode='Announcements' style={{flex: 1, ...globalStyles.flexBoxCenter}}>You can give them this invite link:</BannerText>
      <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'flex-end'}}>
        <Icon onClick={props.onClickInviteLink} type='iconfont-link' style={{fontSize: 14, color: globalColors.white_40, marginRight: globalMargins.xtiny}} />
        <BannerText type='BodySemiboldLink' onClick={props.onClickInviteLink}>{props.inviteLink}</BannerText>
      </Box>
    </Header>
  )
}

const Banner = (props: Props) => {
  if (props.type === 'Error') {
    return <ErrorBanner {...props} />
  } else if (props.type === 'Invite') {
    return <InviteBanner {...props} />
  } else if (props.type === 'BrokenTracker') {
    return <BrokenTrackerBanner {...props} />
  }

  return <Header style={{backgroundColor: globalColors.blue}} title={props.text} />
}

export default Banner
