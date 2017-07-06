// @flow
import React from 'react'
import {Text, Header as CommonHeader} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {intersperseFn} from '../../../util/arrays'

import type {ErrorProps, InviteProps, BrokenTrackerProps, InfoProps} from '.'

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

function brokenSeparator(idx, item, arr) {
  if (idx === arr.length) {
    return null
  } else if (idx === arr.length - 1) {
    return (
      <BannerText key={idx} style={brokenStyle}>
        {arr.length === 1 ? '' : ','}&nbsp;and&nbsp;
      </BannerText>
    )
  } else {
    return (
      <BannerText key={idx} style={brokenStyle}>
        ,&nbsp;
      </BannerText>
    )
  }
}

const Header = ({children, title = '', style = {}}: any) =>
  <CommonHeader windowDragging={false} style={{...commonHeaderStyle, ...style}} type="Strong" title={title}>
    {children}
  </CommonHeader>

const BannerText = props => <Text type="BodySemibold" backgroundMode="Announcements" {...props} />

const BrokenTrackerBanner = ({users, onClick}: BrokenTrackerProps) =>
  users.length === 1
    ? <Header style={globalStyles.flexBoxRow}>
        <BannerText style={brokenStyle}>Some of&nbsp;</BannerText>
        <BannerText type="BodySemiboldLink" style={brokenStyle} onClick={() => onClick(users[0])}>
          {users[0]}
        </BannerText>
        <BannerText style={brokenStyle}>'s proofs have changed since you last followed them.</BannerText>
      </Header>
    : <Header style={globalStyles.flexBoxRow}>
        {intersperseFn(
          brokenSeparator,
          users.map((user, idx) =>
            <BannerText type="BodySemiboldLink" key={user} style={brokenStyle} onClick={() => onClick(user)}>
              {user}
            </BannerText>
          )
        )}
        <BannerText style={brokenStyle}>
          &nbsp;have changed their proofs since you last followed them.
        </BannerText>
      </Header>

const ErrorBanner = ({text, textLink, textLinkOnClick}: ErrorProps) =>
  <Header>
    <BannerText style={{flex: 1, ...globalStyles.flexBoxCenter}}>
      {text}
    </BannerText>
    <BannerText type="BodySemiboldLink" onClick={textLinkOnClick} style={{textAlign: 'center'}}>
      {textLink}
    </BannerText>
  </Header>

const InviteBanner = ({users}: InviteProps) =>
  <Header style={{backgroundColor: globalColors.blue}}>
    <BannerText style={{flex: 1, ...globalStyles.flexBoxCenter}}>
      Your messages to {users.join(' & ')} will unlock when they join Keybase.
    </BannerText>
  </Header>

const InfoBanner = ({text}: InfoProps) =>
  <Header style={{backgroundColor: globalColors.blue}}>
    <BannerText>
      {text}
    </BannerText>
  </Header>

export {BrokenTrackerBanner, ErrorBanner, InviteBanner, InfoBanner}
