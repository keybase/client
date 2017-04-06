// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {intersperseFn} from '../../../util/arrays'

import type {ErrorProps, InviteProps, BrokenTrackerProps, InfoProps} from '.'

const commonBannerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  flexWrap: 'wrap',
  justifyContent: 'center',
  paddingBottom: 8,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 8,
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

const BrokenTrackerBanner = ({users, onClick}: BrokenTrackerProps) => (
  (users.length === 1)
  ? (
    <BannerBox color={globalColors.red}>
      <BannerText>
        <BannerText>Some of&nbsp;</BannerText>
        <BannerText type='BodySemiboldLink' onClick={() => onClick(users[0])}>{users[0]}</BannerText>
        <BannerText>'s proofs have changed since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
    )
  : (
    <BannerBox color={globalColors.red}>
      <BannerText>
        {intersperseFn(brokenSeparator, users.map((user, idx) => (
          <BannerText type='BodySemiboldLink' key={user} onClick={() => onClick(user)}>{user}</BannerText>
        )))}
        <BannerText>&nbsp;have changed their proofs since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
  )
)

const ErrorBanner = ({text, textLink, textLinkOnClick}: ErrorProps) => (
  <BannerBox color={globalColors.red}>
    <BannerText>{text}</BannerText>
    <BannerText type='BodySemiboldLink' onClick={textLinkOnClick}>
      {textLink}
    </BannerText>
  </BannerBox>
)

const InviteBanner = ({users}: InviteProps) => (
  <BannerBox color={globalColors.blue}>
    <BannerText>Your messages to {users.join(' & ')} will unlock when they join Keybase.</BannerText>
  </BannerBox>
)

const InfoBanner = ({text}: InfoProps) => (
  <BannerBox color={globalColors.blue}>
    <BannerText>{text}</BannerText>
  </BannerBox>
)

export {
  BrokenTrackerBanner,
  ErrorBanner,
  InviteBanner,
  InfoBanner,
}
