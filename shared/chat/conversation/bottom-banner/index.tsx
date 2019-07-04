import * as React from 'react'
import {Box, Button, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {intersperseFn} from '../../../util/arrays'
import flags from '../../../util/feature-flags'
import {isMobile} from '../../../constants/platform'

export type BrokenTrackerProps = {
  users: Array<string>
  onClick: (user: string) => void
}

export type InviteProps = {
  openShareSheet: () => void
  openSMS: (email: string) => void
  users: Array<string>
}

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

const BannerBox = (props: {children: React.ReactNode; color: string}) => (
  <Box style={{...commonBannerStyle, backgroundColor: props.color}}>{props.children}</Box>
)

const BannerText = props => <Text center={true} type="BodySmallSemibold" negative={true} {...props} />

function brokenSeparator(idx, item, arr) {
  if (idx === arr.length) {
    return null
  } else if (idx === arr.length - 1) {
    return (
      <BannerText key={idx}>
        {arr.length === 1 ? '' : ','}
        &nbsp;and&nbsp;
      </BannerText>
    )
  } else {
    return <BannerText key={idx}>,&nbsp;</BannerText>
  }
}

const BrokenTrackerBanner = ({users, onClick}: BrokenTrackerProps) =>
  users.length === 1 ? (
    <BannerBox color={globalColors.red}>
      <BannerText>
        <BannerText>Some of&nbsp;</BannerText>
        <BannerText type="BodySmallSemiboldPrimaryLink" onClick={() => onClick(users[0])}>
          {users[0]}
        </BannerText>
        <BannerText>'s proofs have changed since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
  ) : (
    <BannerBox color={globalColors.red}>
      <BannerText>
        {intersperseFn(
          brokenSeparator,
          users.map((user, idx) => (
            <BannerText type="BodySmallSemiboldPrimaryLink" key={user} onClick={() => onClick(user)}>
              {user}
            </BannerText>
          ))
        )}
        <BannerText>&nbsp;have changed their proofs since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
  )

const InviteBanner = ({users, openSMS, openShareSheet}: InviteProps) => {
  if (!flags.sbsContacts) {
    return (
      <BannerBox color={globalColors.blue}>
        <BannerText>Your messages to {users.join(' & ')} will unlock when they join Keybase.</BannerText>
      </BannerBox>
    )
  }

  // On mobile, single recipient, a phone number
  if (isMobile && users.length === 1 && users[0].endsWith('@phone')) {
    return (
      <BannerBox color={globalColors.blue}>
        <BannerText>Last step: summon Firstname Lastman!</BannerText>
        <Button
          label="Send install link"
          onClick={() => openSMS(users[0].slice(0, -6))}
          mode="Secondary"
          style={{
            marginTop: globalMargins.xxtiny,
          }}
        />
      </BannerBox>
    )
  }

  // Any number of recipients, behaviour depends on the platform
  return (
    <BannerBox color={globalColors.blue}>
      <BannerText>
        {users.length === 1
          ? 'Last step: summon Firstname Lastman!'
          : `Last step: summon these ${users.length} people!`}
      </BannerText>
      <Button
        label="Send install link"
        onClick={() => (isMobile ? openShareSheet() : console.log('oh'))}
        mode="Secondary"
        style={{
          marginTop: globalMargins.xxtiny,
        }}
      />
    </BannerBox>
  )
}

export {BrokenTrackerBanner, InviteBanner}
