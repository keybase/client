import * as Constants from '../../../constants/chat2'
import * as UsersConstants from '../../../constants/users'
import * as Followers from '../../../constants/followers'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import openSMS from '../../../util/sms'
import {InviteBanner} from '.'
import {showShareActionSheet} from '../../../actions/platform-specific'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

const Invite = () => {
  const participantInfo = Constants.useContext(s => s.participants)
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

  const onDismiss = Constants.useContext(s => s.dispatch.dismissBottomBanner)

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
  const following = Followers.useFollowerState(s => s.following)
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const participantInfo = Constants.useContext(s => s.participants)
  const users = participantInfo.all.filter(p => following.has(p) && infoMap.get(p)?.broken)
  return <Kb.ProofBrokenBanner users={users} />
}

const BannerContainer = React.memo(function BannerContainer() {
  const following = Followers.useFollowerState(s => s.following)
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const dismissed = Constants.useContext(s => s.dismissedInviteBanners)
  const participantInfo = Constants.useContext(s => s.participants)
  const type = Constants.useContext(s => {
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
