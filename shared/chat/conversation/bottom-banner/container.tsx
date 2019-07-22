import * as Constants from '../../../constants/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as React from 'react'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import {BrokenTrackerBanner, InviteBanner} from '.'
import openSMS from '../../../util/sms'
import {showShareActionSheetFromURL} from '../../../actions/platform-specific'

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/app`

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

type Props = {
  type: 'invite' | 'none' | 'broken'
  onClick: (username: string) => void
  users: Array<string>
  openShareSheet: () => void
  openSMS: (email: string) => void
  usernameToContactName: {[username: string]: string}
}

class BannerContainer extends React.PureComponent<Props> {
  render() {
    switch (this.props.type) {
      case 'invite':
        return (
          <InviteBanner
            openShareSheet={this.props.openShareSheet}
            openSMS={this.props.openSMS}
            users={this.props.users}
            usernameToContactName={this.props.usernameToContactName}
          />
        )
      case 'broken':
        return <BrokenTrackerBanner onClick={this.props.onClick} users={this.props.users} />
      case 'none':
        return null
    }
    return null
  }
}

const mapStateToProps = (state: Container.TypedState, {conversationIDKey}: OwnProps) => {
  const _following = state.config.following
  const _meta = Constants.getMeta(state, conversationIDKey)
  const _users = state.users
  return {
    _following,
    _meta,
    _users,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onClick: Container.isMobile
    ? (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))
    : (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    let type
    let users: Array<string> = []

    if (stateProps._meta.teamType !== 'adhoc') {
      type = 'none'
    } else {
      const broken = stateProps._meta.participants.filter(
        p => stateProps._users.infoMap.getIn([p, 'broken'], false) && stateProps._following.has(p)
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
      onClick: dispatchProps.onClick,
      openSMS: (phoneNumber: string) => openSMS(['+' + phoneNumber], installMessage),
      openShareSheet: () =>
        showShareActionSheetFromURL({
          message: installMessage,
          mimeType: 'text/plain',
        }),
      type,
      usernameToContactName: stateProps._meta.participantToContactName.toObject(),
      users,
    }
  }
)(BannerContainer)
