// @flow
import React from 'react'
import {Text, Header as CommonHeader} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {intersperseFn} from '../../util/arrays'

import type {Props, ErrorVariant, InviteVariant, BrokenTrackerVariant} from './banner'

const brokenStyle = {
  display: 'inline-block',
}

const commonHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  flexWrap: 'wrap',
  justifyContent: 'center',
  padding: 6,
}

function brokenSeparator (idx, item, arr) {
  if (idx === arr.length) {
    return null
  } else if (idx === arr.length - 1) {
    return <BannerText key={idx} style={brokenStyle}>{arr.length === 1 ? '' : ','}&nbsp;and&nbsp;</BannerText>
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
      <BannerText style={{flex: 1, ...globalStyles.flexBoxCenter}}>Your messages to {props.users.join(' & ')} will unlock when they join Keybase.</BannerText>
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

  return (
    <Header style={{backgroundColor: globalColors.blue}}>
      <BannerText>{props.text}</BannerText>
    </Header>
  )
}

export default Banner
