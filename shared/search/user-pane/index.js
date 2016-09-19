// @flow
import {fullName} from '../../constants/search'
import keybaseUrl from '../../constants/urls'
import {TypedConnector} from '../../util/typed-connect'
import {getProfile, onFollow, onUnfollow} from '../../actions/tracker'
import {setActive} from '../../actions/search'
import {onClickAvatar, onClickFollowers, onClickFollowing} from '../../actions/profile'
import openURL from '../../util/open-url'
import Render from './render'

import type {Props} from './render'
import type {TypedState} from '../../constants/reducer'
import type {SearchActions} from '../../constants/search'
import type {TypedDispatch} from '../../constants/types/flux'

type OwnProps = { }

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({search: {userForInfoPane}, tracker: {trackers}, config: {username: myUsername}}, dispatch, ownProps) => {
    if (userForInfoPane && userForInfoPane.service === 'keybase') {
      const username = userForInfoPane.username
      const trackerState = trackers[username]
      if (username && trackerState && trackerState.type === 'tracker' && !!trackerState.error) {
        return {
          mode: 'error',
          error: trackerState.error,
        }
      }
      if (username && trackerState && trackerState.type === 'tracker') {
        const {userInfo: {uid}} = trackerState
        const currentlyFollowing = trackerState.lastAction === 'followed' || trackerState.lastAction === 'refollowed' || trackerState.currentlyFollowing
        // TODO (mm) ideally userInfo should be null until we get a response from the server
        // Same with proofs (instead of empty array). So we know the difference between
        // not having data and having empty data.
        const loading = trackerState.userInfo.followersCount === -1
        return {
          mode: 'keybase',
          userInfoProps: {
            username: username,
            userInfo: trackerState.userInfo,
            isYou: username === myUsername,
            proofs: trackerState.proofs,
            loading: loading,
            currentlyFollowing: currentlyFollowing,
            trackerState: trackerState.trackerState,
            onFollow: () => { dispatch(onFollow(username, false)) },
            onUnfollow: () => { dispatch(onUnfollow(username)) },
            onAcceptProofs: () => { dispatch(onFollow(username, false)) },
            onClickAvatar: () => {
              dispatch(setActive(false))
              dispatch(onClickAvatar(username, uid))
            },
            onClickFollowers: () => {
              dispatch(setActive(false))
              dispatch(onClickFollowers(username, uid))
            },
            onClickFollowing: () => {
              dispatch(setActive(false))
              dispatch(onClickFollowing(username, uid))
            },
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
          avatar: userForInfoPane.serviceAvatar || '',
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
  })(Render)
