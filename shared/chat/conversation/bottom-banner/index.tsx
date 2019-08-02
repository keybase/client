import * as React from 'react'
import {Box2, Button, Text} from '../../../common-adapters'
import {assertionToDisplay} from '../../../common-adapters/usernames'
import * as Styles from '../../../styles'
import {intersperseFn} from '../../../util/arrays'
import flags from '../../../util/feature-flags'
import {isMobile} from '../../../constants/platform'

export type BrokenTrackerProps = {
  users: Array<string>
  onClick: (user: string) => void
}

export type InviteProps = {
  openShareSheet: () => void
  openSMS: (phoneNumber: string) => void
  usernameToContactName: {[username: string]: string}
  users: Array<string>
}

const BannerBox = (props: {
  children: React.ReactNode
  color: string
  gap?: keyof typeof Styles.globalMargins
}) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.bannerStyle, {backgroundColor: props.color}])}
    gap={props.gap}
  >
    {props.children}
  </Box2>
)

const BannerText = props => <Text center={true} type="BodySmallSemibold" negative={true} {...props} />

function brokenSeparator(idx, _, arr) {
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
    <BannerBox color={Styles.globalColors.red}>
      <BannerText>
        <BannerText>Some of&nbsp;</BannerText>
        <BannerText type="BodySmallSemiboldPrimaryLink" onClick={() => onClick(users[0])}>
          {users[0]}
        </BannerText>
        <BannerText>'s proofs have changed since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
  ) : (
    <BannerBox color={Styles.globalColors.red}>
      <BannerText>
        {intersperseFn(
          brokenSeparator,
          users.map(user => (
            <BannerText type="BodySmallSemiboldPrimaryLink" key={user} onClick={() => onClick(user)}>
              {user}
            </BannerText>
          ))
        )}
        <BannerText>&nbsp;have changed their proofs since you last followed them.</BannerText>
      </BannerText>
    </BannerBox>
  )

const InviteBanner = ({users, openSMS, openShareSheet, usernameToContactName}: InviteProps) => {
  if (!flags.sbsContacts) {
    return (
      <BannerBox color={Styles.globalColors.blue}>
        <BannerText>Your messages to {users.join(' & ')} will unlock when they join Keybase.</BannerText>
      </BannerBox>
    )
  }

  const theirName =
    users.length === 1
      ? usernameToContactName[users[0]] || assertionToDisplay(users[0])
      : `these ${users.length} people`

  // On mobile, single recipient, a phone number
  if (isMobile && users.length === 1 && users[0].endsWith('@phone')) {
    return (
      <BannerBox color={Styles.globalColors.blue} gap="xtiny">
        <BannerText>Last step: summon {theirName}!</BannerText>
        <Button label="Send install link" onClick={() => openSMS(users[0].slice(0, -6))} mode="Secondary" />
      </BannerBox>
    )
  }

  // Any number of recipients, on iOS / Android show the share screen
  if (isMobile) {
    return (
      <BannerBox color={Styles.globalColors.blue} gap="xtiny">
        <BannerText>Last step: summon {theirName}!</BannerText>
        <Button label="Send install link" onClick={openShareSheet} mode="Secondary" />
      </BannerBox>
    )
  }

  const hasPhoneNumber = users.some(user => user.endsWith('@phone'))
  const hasEmailAddress = users.some(user => user.endsWith('@email'))

  let caption = 'Your messages will unlock once they join Keybase'
  if (hasPhoneNumber && hasEmailAddress) {
    caption += ' and verify their phone number or email address'
  } else if (hasPhoneNumber) {
    caption += ' and verify their phone number'
  } else if (hasEmailAddress) {
    caption += ' and verify their email address'
  }
  caption += '.'

  return (
    <BannerBox color={Styles.globalColors.blue}>
      <BannerText>{caption}</BannerText>
      <BannerText>
        Send them this link:
        <BannerText
          onClickURL="https://keybase.io/app"
          underline={true}
          type="BodySmallPrimaryLink"
          style={{marginLeft: Styles.globalMargins.xtiny}}
        >
          https://keybase.io/app
        </BannerText>
      </BannerText>
    </BannerBox>
  )
}

const styles = Styles.styleSheetCreate({
  bannerStyle: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.red,
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingBottom: 8,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 8,
    },
    isElectron: {
      marginBottom: Styles.globalMargins.tiny,
    },
  }),
})

export {BrokenTrackerBanner, InviteBanner}
