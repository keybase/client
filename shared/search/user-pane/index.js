// @flow
import React, {Component} from 'react'
import UserInfo from './user.render'
import NonUserInfo from './non-user.render'
import Help from './help'
import Loading from './loading'

import {fullName} from '../../constants/search'
import keybaseUrl from '../../constants/urls'
import {TypedConnector} from '../../util/typed-connect'

import {getProfile, onFollow, onUnfollow} from '../../actions/tracker'

import openURL from '../../util/open-url'

import type {Props as UserInfoPaneProps} from './user.render'
import type {Props as NonUserInfoProps} from './non-user.render'

import type {TypedState} from '../../constants/reducer'
import type {SearchActions} from '../../constants/search'
import type {TypedDispatch} from '../../constants/types/flux'

type OwnProps = {
  userInfoProps?: ?UserInfoPaneProps,
}

type Props = {
  mode: 'keybase',
  userInfoProps: UserInfoPaneProps,
} | {
  mode: 'external',
  nonUserInfoProps: NonUserInfoProps,
} | {
  mode: 'loading',
  username: string,
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
      return <Loading username={this.props.username} />
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
    // Allow local overriding
    if (ownProps.userForInfoPane) {
      userForInfoPane = ownProps.userForInfoPane
    }

    if (userForInfoPane && userForInfoPane.service === 'keybase') {
      const username = userForInfoPane.username
      const trackerState = trackers[username]
      if (username && trackerState && trackerState.type === 'tracker') {
        const currentlyFollowing = trackerState.lastAction === 'followed' || trackerState.lastAction === 'refollowed' || trackerState.currentlyFollowing
        return {
          mode: 'keybase',
          userInfoProps: {
            username: username,
            userInfo: trackerState.userInfo,
            proofs: trackerState.proofs,
            currentlyFollowing: currentlyFollowing,
            trackerState: trackerState.trackerState,
            onFollow: () => { dispatch(onFollow(username, false)) },
            onUnfollow: () => { dispatch(onUnfollow(username)) },
            onAcceptProofs: () => { dispatch(onFollow(username, false)) },
          },
        }
      } else {
        // We have to fetch the tracker state, so lets do that.
        dispatch(getProfile(username))

        // Enter loading mode, when the store gets updated we'll come back to here
        return {
          mode: 'loading',
          username,
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
          onSendInvite: () => { openURL(`${keybaseUrl}/account/invitations`) },
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
