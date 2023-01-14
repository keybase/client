import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import {InviteBanner} from '.'
import openSMS from '../../../util/sms'
import {showShareActionSheet} from '../../../actions/platform-specific'
import shallowEqual from 'shallowequal'

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

  const dispatch = Container.useDispatch()
  const onDismiss = () => {
    dispatch(Chat2Gen.createDismissBottomBanner({conversationIDKey}))
  }

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
  const users = Container.useSelector(state => {
    const {following} = state.config
    const {infoMap} = state.users
    const participantInfoAll = Constants.getParticipantInfo(state, conversationIDKey).all
    return participantInfoAll.filter(p => following.has(p) && infoMap.get(p)?.broken)
  }, shallowEqual)
  return <Kb.ProofBrokenBanner users={users} />
}

const BannerContainer = React.memo(function BannerContainer(p: {conversationIDKey: Types.ConversationIDKey}) {
  const {conversationIDKey} = p
  const type = Container.useSelector(state => {
    const teamType = Constants.getMeta(state, conversationIDKey).teamType
    if (teamType !== 'adhoc') {
      return 'none'
    }
    const {following} = state.config
    const participantInfoAll = Constants.getParticipantInfo(state, conversationIDKey).all
    const {infoMap} = state.users
    const broken = participantInfoAll.some(p => following.has(p) && infoMap.get(p)?.broken)
    if (broken) {
      return 'broken'
    } else {
      const toInvite = participantInfoAll.some(p => p.includes('@'))
      const dismissed = state.chat2.dismissedInviteBannersMap.get(conversationIDKey) || false
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
