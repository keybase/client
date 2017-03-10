// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {intersperseFn} from '../../util/arrays'

import type {Props, ErrorVariant, InviteVariant, BrokenTrackerVariant} from './banner'

const commonBannerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  flexWrap: 'wrap',
  justifyContent: 'center',
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 8,
  paddingBottom: 8,
}

const BannerBox = (props) => (
  <Box style={{...commonBannerStyle, backgroundColor: props.color}}>
    {props.children}
  </Box>
)

const BannerText = (props) => (
  <Text type='BodySemibold' backgroundMode='Announcements' style={{textAlign: 'center'}} {...props} />
)

function brokenSeparator (idx, item, arr) {
  if (idx === arr.length) {
    return null
  } else if (idx === arr.length - 1) {
    return <BannerText key={idx}>{arr.length === 1 ? '' : ','}&nbsp;and&nbsp;</BannerText>
  } else {
    return <BannerText key={idx}>,&nbsp;</BannerText>
  }
}

const BrokenTrackerBanner = (props: BrokenTrackerVariant) => {
  if (props.users.length === 1) {
    const user = props.users[0]
    return (
      <BannerBox color={globalColors.red}>
        <BannerText>
          <BannerText>Some of&nbsp;</BannerText>
          <BannerText type='BodySemiboldLink' onClick={() => props.onClick(user)}>{user}</BannerText>
          <BannerText>'s proofs have changed since you last followed them.</BannerText>
        </BannerText>
      </BannerBox>
    )
  } else {
    return (
      <BannerBox color={globalColors.red}>
        <BannerText>
          {intersperseFn(brokenSeparator, props.users.map((user, idx) => (
            <BannerText type='BodySemiboldLink' key={user} onClick={() => props.onClick(user)}>{user}</BannerText>
          )))}
          <BannerText>&nbsp;have changed their proofs since you last followed them.</BannerText>
        </BannerText>
      </BannerBox>
    )
  }
}

const ErrorBanner = (props: ErrorVariant) => {
  return (
    <BannerBox color={globalColors.red}>
      <BannerText>{props.text}</BannerText>
      <BannerText type='BodySemiboldLink' onClick={props.textLinkOnClick}>
        {props.textLink}
      </BannerText>
    </BannerBox>
  )
}

const InviteBanner = (props: InviteVariant) => {
  return (
    <BannerBox color={globalColors.blue}>
      <BannerText>Your messages to {props.users.join(' & ')} will unlock when they join Keybase.</BannerText>
    </BannerBox>
  )
}

const Banner = ({message}: Props) => {
  if (message.type === 'Error') {
    return <ErrorBanner {...message} />
  } else if (message.type === 'Invite') {
    return <InviteBanner {...message} />
  } else if (message.type === 'BrokenTracker') {
    return <BrokenTrackerBanner {...message} />
  }

  return (
    <BannerBox color={globalColors.blue}>
      <BannerText>{message.text}</BannerText>
    </BannerBox>
  )
}

export default Banner
