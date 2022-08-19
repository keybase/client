import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import {InviteBanner} from '.'
import openSMS from '../../../util/sms'
import {showShareActionSheet} from '../../../actions/platform-specific'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

const Invite = (p: {users: Array<string>; conversationIDKey: Types.ConversationIDKey}) => {
  const {users, conversationIDKey} = p

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

const Broken = (p: {users: Array<string>}) => {
  const {users} = p
  return <Kb.ProofBrokenBanner users={users} />
}

const BannerContainer = React.memo((p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const following = Container.useSelector(state => state.config.following)
  const participantInfoAll = Container.useSelector(
    state => Constants.getParticipantInfo(state, conversationIDKey).all
  )
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const dismissed = Container.useSelector(
    state => state.chat2.dismissedInviteBannersMap.get(conversationIDKey) || false
  )
  const hasMessages = Container.useSelector(state => !Constants.getMeta(state, conversationIDKey).isEmpty)
  const teamType = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).teamType)

  let type: 'invite' | 'none' | 'broken'
  let users: Array<string> = []
  if (teamType !== 'adhoc') {
    type = 'none'
  } else {
    const broken = participantInfoAll.filter(p => following.has(p) && infoMap.get(p)?.broken)
    if (broken.length > 0) {
      type = 'broken'
      users = broken
    } else {
      const toInvite = participantInfoAll.filter(p => p.includes('@'))
      if (toInvite.length > 0) {
        type = 'invite'
        users = toInvite
      } else {
        type = 'none'
      }
    }
  }

  switch (type) {
    case 'invite':
      return !dismissed && hasMessages ? <Invite users={users} conversationIDKey={conversationIDKey} /> : null
    case 'broken':
      return <Broken users={users} />
    case 'none':
      return null
  }
})

export default BannerContainer
