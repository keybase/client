import * as React from 'react'
import {Box2, Button, Text} from '../../../common-adapters'
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
    style={{
      ...styles.bannerStyle,
      backgroundColor: props.color,
    }}
    gap={props.gap}
  >
    {props.children}
  </Box2>
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
      <BannerBox color={Styles.globalColors.blue}>
        <BannerText>Your messages to {users.join(' & ')} will unlock when they join Keybase.</BannerText>
      </BannerBox>
    )
  }

  // On mobile, single recipient, a phone number
  if (isMobile && users.length === 1 && users[0].endsWith('@phone')) {
    return (
      <BannerBox color={Styles.globalColors.blue} gap="xtiny">
        <BannerText>Last step: summon Firstname Lastman!</BannerText>
        <Button label="Send install link" onClick={() => openSMS(users[0].slice(0, -6))} mode="Secondary" />
      </BannerBox>
    )
  }

  // Any number of recipients, on iOS / Android show the share screen
  if (!isMobile) {
    return (
      <BannerBox color={Styles.globalColors.blue} gap="xtiny">
        <BannerText>
          {users.length === 1
            ? 'Last step: summon Firstname Lastman!'
            : `Last step: summon these ${users.length} people!`}
        </BannerText>
        <Button label="Send install link" onClick={openShareSheet} mode="Secondary" />
      </BannerBox>
    )
  }

  // Android fallback
  return (
    <BannerBox color={Styles.globalColors.blue}>
      <BannerText>Your messages will unlock once they join Keybase and verify their phone number.</BannerText>
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
