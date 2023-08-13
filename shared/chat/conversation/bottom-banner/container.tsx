import * as C from '../../../constants'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import openSMS from '../../../util/sms'
import {InviteBanner} from '.'
import {showShareActionSheet} from '../../../actions/platform-specific'

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

  const onOpenSMS = (phoneNumber: string) => {
    openSMS(['+' + phoneNumber], installMessage)
      .then(() => {})
      .catch(() => {})
  }

  const usernameToContactName = participantInfo.contactName

  const onDismiss = C.useChatContext(s => s.dispatch.dismissBottomBanner)

  return (
    <InviteBanner
      openShareSheet={openShareSheet}
      openSMS={onOpenSMS}
      onDismiss={onDismiss}
      users={users}
      usernameToContactName={usernameToContactName}
    />
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
