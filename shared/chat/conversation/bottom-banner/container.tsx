import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import {InviteBanner} from '.'
import openSMS from '../../../util/sms'
import {showShareActionSheet} from '../../../actions/platform-specific'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

type Props = {
  type: 'invite' | 'none' | 'broken'
  users: Array<string>
  hasMessages: boolean
  dismissed: boolean
  openShareSheet: () => void
  openSMS: (email: string) => void
  onDismiss: () => void
  usernameToContactName: {[username: string]: string}
}

const BannerContainer = (props: Props) => {
  switch (props.type) {
    case 'invite':
      return !props.dismissed && props.hasMessages ? (
        <InviteBanner
          openShareSheet={props.openShareSheet}
          openSMS={props.openSMS}
          onDismiss={props.onDismiss}
          users={props.users}
          usernameToContactName={props.usernameToContactName}
        />
      ) : null
    case 'broken':
      return <Kb.ProofBrokenBanner users={props.users} />
    case 'none':
      return null
  }
}

const mapStateToProps = (state: Container.TypedState, {conversationIDKey}: OwnProps) => {
  const _following = state.config.following
  const _meta = Constants.getMeta(state, conversationIDKey)
  const _users = state.users
  const _dismissed = state.chat2.dismissedInviteBannersMap.get(conversationIDKey, false)
  return {
    _dismissed,
    _following,
    _meta,
    _users,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onDismiss: () =>
    dispatch(Chat2Gen.createDismissBottomBanner({conversationIDKey: ownProps.conversationIDKey})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    let type: Props['type']
    let users: Array<string> = []

    if (stateProps._meta.teamType !== 'adhoc') {
      type = 'none'
    } else {
      const broken = stateProps._meta.participants.filter(
        p => (stateProps._users.infoMap.get(p) || {broken: false}).broken && stateProps._following.has(p)
      )

      if (!broken.isEmpty()) {
        type = 'broken'
        users = broken.toArray()
      } else {
        const toInvite = stateProps._meta.participants.filter(p => p.includes('@'))
        if (!toInvite.isEmpty()) {
          type = 'invite'
          users = toInvite.toArray()
        } else {
          type = 'none'
        }
      }
    }

    return {
      dismissed: stateProps._dismissed,
      hasMessages: !stateProps._meta.isEmpty,
      onDismiss: dispatchProps.onDismiss,
      openSMS: (phoneNumber: string) => openSMS(['+' + phoneNumber], installMessage),
      openShareSheet: () =>
        showShareActionSheet({
          message: installMessage,
          mimeType: 'text/plain',
        }),
      type,
      usernameToContactName: stateProps._meta.participantToContactName.toObject(),
      users,
    }
  }
)(BannerContainer)
