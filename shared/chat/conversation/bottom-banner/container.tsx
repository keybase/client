import * as Constants from '../../../constants/chat2'
import * as UsersConstants from '../../../constants/users'
import * as Container from '../../../util/container'
import * as Followers from '../../../constants/followers'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import openSMS from '../../../util/sms'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../constants/types/chat2'
import {InviteBanner} from '.'
import {showShareActionSheet} from '../../../actions/platform-specific'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

const Invite = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const participantInfoAll = Container.useSelector(
    state => Constants.getParticipantInfo(state, conversationIDKey).all
  )
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

  const usernameToContactName = Container.useSelector(
    state => Constants.getParticipantInfo(state, conversationIDKey).contactName
  )

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

const Broken = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p

  const following = Followers.useFollowerState(s => s.following)
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const users = Container.useSelector(state => {
    const participantInfoAll = Constants.getParticipantInfo(state, conversationIDKey).all
    return participantInfoAll.filter(p => following.has(p) && infoMap.get(p)?.broken)
  }, shallowEqual)
  return <Kb.ProofBrokenBanner users={users} />
}

const BannerContainer = React.memo(function BannerContainer(p: {conversationIDKey: Types.ConversationIDKey}) {
  const {conversationIDKey} = p
  const following = Followers.useFollowerState(s => s.following)
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const dismissed = Constants.useContext(s => s.dismissedInviteBanners)
  const type = Container.useSelector(state => {
    const teamType = Constants.getMeta(state, conversationIDKey).teamType
    if (teamType !== 'adhoc') {
      return 'none'
    }
    const participantInfoAll = Constants.getParticipantInfo(state, conversationIDKey).all
    const broken = participantInfoAll.some(p => following.has(p) && infoMap.get(p)?.broken)
    if (broken) {
      return 'broken'
    } else {
      const toInvite = participantInfoAll.some(p => p.includes('@'))
      const hasMessages = !Constants.getMeta(state, conversationIDKey).isEmpty
      if (toInvite && !dismissed && hasMessages) {
        return 'invite'
      } else {
        return 'none'
      }
    }
  })

  switch (type) {
    case 'invite':
      return <Invite conversationIDKey={conversationIDKey} />
    case 'broken':
      return <Broken conversationIDKey={conversationIDKey} />
    case 'none':
      return null
  }
})

export default BannerContainer
