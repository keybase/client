// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import {BrokenTrackerBanner, InviteBanner} from '.'
import {connect, type TypedState} from '../../../util/container'
import {createGetProfile} from '../../../actions/tracker-gen'
import {isMobile} from '../../../constants/platform'
import {createShowUserProfile} from '../../../actions/profile-gen'

type Props = {
  type: 'invite' | 'none' | 'broken',
  onClick: (username: string) => void,
  users: Array<string>,
}

class BannerContainer extends React.PureComponent<Props> {
  render() {
    switch (this.props.type) {
      case 'invite':
        return <InviteBanner users={this.props.users} />
      case 'broken':
        return <BrokenTrackerBanner onClick={this.props.onClick} users={this.props.users} />
      case 'none':
        return null
    }
  }
}

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const _meta = Constants.getMeta(state, conversationIDKey)
  const _users = state.users
  return {
    _meta,
    _users,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: isMobile
    ? (username: string) => dispatch(createShowUserProfile({username}))
    : (username: string) => dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let type
  let users

  if (stateProps._meta.teamType !== 'adhoc') {
    type = 'none'
  } else {
    const broken = stateProps._meta.participants.filter(p =>
      stateProps._users.infoMap.getIn([p, 'broken'], false)
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
    type,
    users: users || [],
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BannerContainer)
