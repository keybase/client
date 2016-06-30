// @flow
import React, {Component} from 'react'
import UserInfo from './user.render'
import NonUserInfo from './non-user.render'
import Help from './help'

import {fullName} from '../../constants/search'
import {TypedConnector} from '../../util/typed-connect'

import {Text} from '../../common-adapters'

import {getProfile} from '../../actions/tracker'

import type {Props as UserInfoPaneProps} from './user.render'
import type {Props as NonUserInfoProps} from './non-user.render'

import type {TypedState} from '../../constants/reducer'
import type {SearchActions} from '../../constants/search'
import type {TypedDispatch} from '../../constants/types/flux'

type OwnProps = {}

type Props = {
  mode: 'keybase',
  userInfoProps: UserInfoPaneProps,
} | {
  mode: 'external',
  nonUserInfoProps: NonUserInfoProps,
} | {
  mode: 'loading'
} | {
  mode: 'nothingSelected'
}

class UserPane extends Component<void, Props, void> {
  render () {
    if (this.props.mode === 'keybase') {
      return <UserInfo {...this.props.userInfoProps} />
    } else if (this.props.mode === 'external') {
      return <NonUserInfo {...this.props.nonUserInfoProps} />
    } else if (this.props.mode === 'loading') {
      return <Text type='Body'>TODO: Loading state</Text>
    }

    return (
      <Help />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Search'},
    }
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({search: {userForInfoPane}, tracker: {trackers}}, dispatch, ownProps) => {
    if (userForInfoPane && userForInfoPane.service === 'keybase') {
      const username = userForInfoPane.username
      const trackerState = trackers[username]
      if (username && trackerState && trackerState.type === 'tracker') {
        return {
          mode: 'keybase',
          userInfoProps: {
            username: username,
            userInfo: trackerState.userInfo,
            proofs: trackerState.proofs,
            currentlyFollowing: trackerState.currentlyFollowing,
            trackerState: trackerState.trackerState,
            onFollow: () => { console.log('TODO follow user') },
            onUnfollow: () => { console.log('TODO unfollow user') },
            onAcceptProofs: () => { console.log('TODO accept proofs') },
          },
        }
      } else {
        // We have to fetch the tracker state, so lets do that.
        dispatch(getProfile(username))

        // Enter loading mode, when the store gets updated we'll come back to here
        return {
          mode: 'loading',
        }
      }
    } else if (userForInfoPane && userForInfoPane.service === 'external') {
      return {
        mode: 'external',
        nonUserInfoProps: {
          avatar: userForInfoPane.serviceAvatar,
          username: userForInfoPane.username,
          fullName: fullName(userForInfoPane.extraInfo),
          serviceName: userForInfoPane.serviceName,
          profileUrl: userForInfoPane.profileUrl,
          onSendInvite: () => { console.log('TODO something for sending invite') },
          outOfInvites: null,
          inviteLink: null,
        },
      }
    } else {
      return {
        mode: 'nothingSelected',
      }
    }
  })(UserPane)
