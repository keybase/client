import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import _openSMS from '@/util/sms'
import {showShareActionSheet} from '@/constants/platform-specific'
import {assertionToDisplay} from '@/common-adapters/usernames'
import type {Props as TextProps} from '@/common-adapters/text'
import * as Styles from '@/styles'
import {isMobile} from '@/constants/platform'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

const Invite = () => {
  const participantInfo = C.useChatContext(s => s.participants)
  const participantInfoAll = participantInfo.all
  const users = participantInfoAll.filter(p => p.includes('@'))

  const openShareSheet = () => {
    showShareActionSheet({
      message: installMessage,
      mimeType: 'text/plain',
    })
      .then(() => {})
      .catch(() => {})
  }

  const openSMS = (phoneNumber: string) => {
    _openSMS(['+' + phoneNumber], installMessage)
      .then(() => {})
      .catch(() => {})
  }

  const usernameToContactName = participantInfo.contactName

  const onDismiss = C.useChatContext(s => s.dispatch.dismissBottomBanner)

  const theirName =
    users.length === 1
      ? usernameToContactName.get(users[0]!) || assertionToDisplay(users[0]!)
      : `these ${users.length} people`
  const mobileClickInstall =
    users.length === 1 && users[0]!.endsWith('@phone')
      ? () => openSMS(users[0]!.slice(0, -6))
      : openShareSheet
  const caption = `Last step: summon ${theirName}!`

  if (isMobile) {
    return (
      <BannerBox color={Styles.globalColors.blue} gap="xtiny">
        <BannerText>{caption}</BannerText>
        <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
          <Kb.Button
            label="Send install link"
            onClick={mobileClickInstall}
            small={true}
            backgroundColor="blue"
          />
          <Kb.Button
            label="Dismiss"
            mode="Secondary"
            onClick={onDismiss}
            small={true}
            backgroundColor="blue"
          />
        </Kb.Box2>
      </BannerBox>
    )
  }

  return (
    <BannerBox color={Styles.globalColors.blue}>
      <BannerText>{caption}</BannerText>
      <BannerText>
        Send them this link:
        <BannerText
          onClickURL="https://keybase.io/app"
          underline={true}
          type="BodySmallPrimaryLink"
          selectable={true}
          style={{marginLeft: Styles.globalMargins.xtiny}}
        >
          https://keybase.io/app
        </BannerText>
      </BannerText>
    </BannerBox>
  )
}

const Broken = () => {
  const following = C.useFollowerState(s => s.following)
  const infoMap = C.useUsersState(s => s.infoMap)
  const participantInfo = C.useChatContext(s => s.participants)
  const users = participantInfo.all.filter(p => following.has(p) && infoMap.get(p)?.broken)
  return <Kb.ProofBrokenBanner users={users} />
}

const BannerContainer = React.memo(function BannerContainer() {
  const following = C.useFollowerState(s => s.following)
  const infoMap = C.useUsersState(s => s.infoMap)
  const dismissed = C.useChatContext(s => s.dismissedInviteBanners)
  const participantInfo = C.useChatContext(s => s.participants)
  const type = C.useChatContext(s => {
    const teamType = s.meta.teamType
    if (teamType !== 'adhoc') {
      return 'none'
    }
    const participantInfoAll = participantInfo.all
    const broken = participantInfoAll.some(p => following.has(p) && infoMap.get(p)?.broken)
    if (broken) {
      return 'broken'
    } else {
      const toInvite = participantInfoAll.some(p => p.includes('@'))
      const hasMessages = !s.meta.isEmpty
      if (toInvite && !dismissed && hasMessages) {
        return 'invite'
      } else {
        return 'none'
      }
    }
  })

  switch (type) {
    case 'invite':
      return <Invite />
    case 'broken':
      return <Broken />
    case 'none':
      return null
  }
})

export default BannerContainer

const BannerBox = (props: {
  children: React.ReactNode
  color: string
  gap?: keyof typeof Styles.globalMargins
}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.bannerStyle, {backgroundColor: props.color}])}
    gap={props.gap}
    alignItems="center"
  >
    {props.children}
  </Kb.Box2>
)

const BannerText = (props: Partial<TextProps>) => (
  <Kb.Text center={true} type="BodySmallSemibold" negative={true} {...props} />
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    }) as const
)
