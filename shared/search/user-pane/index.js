// @flow
import * as Constants from '../../constants/search'
import keybaseUrl from '../../constants/urls'
import {TypedConnector} from '../../util/typed-connect'
import {getProfile, onFollow, onUnfollow} from '../../actions/tracker'
import {onClickAvatar, onClickFollowers, onClickFollowing} from '../../actions/profile'
import {startConversation} from '../../actions/chat'
import openURL from '../../util/open-url'
import Render from './render'

import type {Props} from './render'
import type {TypedState} from '../../constants/reducer'
import type {TypedDispatch} from '../../constants/types/flux'

type OwnProps = {}

const connector: TypedConnector<
  TypedState,
  TypedDispatch<Constants.Actions>,
  OwnProps,
  Props
> = new TypedConnector()

export default connector.connect(
  ({search: {userForInfoPane}, tracker: {trackers}, config: {username: myUsername}}, dispatch, ownProps) => {
    if (userForInfoPane && userForInfoPane.service === 'keybase') {
      const username = userForInfoPane.username
      const trackerState = trackers[username]
      if (username && trackerState && trackerState.type === 'tracker' && !!trackerState.error) {
        return {
          error: trackerState.error,
          mode: 'error',
        }
      }
      if (username && trackerState && trackerState.type === 'tracker') {
        const currentlyFollowing =
          trackerState.lastAction === 'followed' ||
          trackerState.lastAction === 'refollowed' ||
          trackerState.currentlyFollowing
        const loading = trackerState.serverActive
        return {
          mode: 'keybase',
          userInfoProps: {
            currentlyFollowing: currentlyFollowing,
            isYou: username === myUsername,
            loading: loading,
            onAcceptProofs: () => {
              dispatch(onFollow(username, false))
            },
            onChat: () => {
              username && myUsername && dispatch(startConversation([username, myUsername]))
            },
            onClickAvatar: () => {
              dispatch(onClickAvatar(username))
            },
            onClickFollowers: () => {
              dispatch(onClickFollowers(username))
            },
            onClickFollowing: () => {
              dispatch(onClickFollowing(username))
            },
            onFollow: () => {
              dispatch(onFollow(username, false))
            },
            onUnfollow: () => {
              dispatch(onUnfollow(username))
            },
            proofs: trackerState.proofs,
            trackerState: trackerState.trackerState,
            userInfo: trackerState.userInfo,
            username: username,
          },
        }
      } else {
        // We have to fetch the tracker state, so lets do that.
        // We have to defer this as we're essentially in a constructor and react doesn't like this
        setImmediate(() => dispatch(getProfile(username)))

        // Enter loading mode, when the store gets updated we'll come back to here
        return {
          loading: true,
          mode: 'loading',
          username,
        }
      }
    } else if (userForInfoPane && userForInfoPane.service === 'external') {
      return {
        mode: 'external',
        nonUserInfoProps: {
          avatar: userForInfoPane.serviceAvatar || '',
          fullName: Constants.fullName(userForInfoPane.extraInfo),
          inviteLink: null,
          onSendInvite: () => {
            openURL(`${keybaseUrl}/account/invitations`)
          },
          outOfInvites: null,
          profileUrl: userForInfoPane.profileUrl,
          serviceName: userForInfoPane.serviceName,
          username: userForInfoPane.username,
        },
      }
    } else {
      return {
        mode: 'nothingSelected',
      }
    }
  }
)(Render)
