// @flow
import ErrorComponent from '../common-adapters/error-profile'
import Profile from './index'
import React, {PureComponent} from 'react'
import {
  addProof,
  onUserClick,
  onClickAvatar,
  onClickFollowers,
  onClickFollowing,
  checkProof,
} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers, onFollow, onUnfollow, openProofUrl} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {isTesting} from '../local-debug'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {openInKBFS} from '../actions/kbfs'
import {profileTab} from '../constants/tabs'
import {startConversation} from '../actions/chat'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {RouteProps} from '../route-tree/render-route'
import type {Props} from './index'
import type {Tab as FriendshipsTab} from './friendships'

type OwnProps = {
  routeProps: {
    username: ?string,
  },
} & RouteProps<{}, {currentFriendshipsTab: FriendshipsTab}>

type EitherProps<P> =
  | {
      type: 'ok',
      okProps: P,
    }
  | {
      type: 'error',
      propError: string,
      onBack: ?() => void,
    }

class ProfileContainer extends PureComponent<void, EitherProps<Props>, void> {
  render() {
    if (this.props.type === 'error') {
      return <ErrorComponent error={this.props.propError} onBack={this.props.onBack} />
    }

    const props = this.props.okProps

    return <Profile {...props} followers={props.followers} following={props.following} />
  }
}

export default connect(
  (state, {routeProps, routeState, routePath}: OwnProps) => {
    const myUsername = state.config.username
    const username = routeProps.username ? routeProps.username : myUsername

    return {
      currentFriendshipsTab: routeState.currentFriendshipsTab,
      myUsername,
      profileIsRoot: routePath.size === 1 && routePath.first() === profileTab,
      trackerState: state.tracker.trackers[username],
      username,
    }
  },
  (dispatch: any, {setRouteState}: OwnProps) => ({
    getProfile: username => dispatch(getProfile(username)),
    onAcceptProofs: username => {
      dispatch(onFollow(username, false))
    },
    onBack: () => {
      dispatch(navigateUp())
    },
    onChangeFriendshipsTab: currentFriendshipsTab => {
      setRouteState({currentFriendshipsTab})
    },
    onChat: (myUsername, username) => {
      dispatch(startConversation([username, myUsername]))
    },
    onClickAvatar: username => {
      dispatch(onClickAvatar(username))
    },
    onClickFollowers: username => {
      dispatch(onClickFollowers(username))
    },
    onClickFollowing: username => {
      dispatch(onClickFollowing(username))
    },
    onEditAvatar: () => {
      dispatch(navigateAppend(['editAvatar']))
    },
    onEditProfile: () => {
      dispatch(navigateAppend(['editProfile']))
    },
    onFolderClick: folder => {
      dispatch(openInKBFS(folder.path))
    },
    onFollow: username => {
      dispatch(onFollow(username, false))
    },
    onMissingProofClick: (missingProof: MissingProof) => {
      dispatch(addProof(missingProof.type))
    },
    onRecheckProof: (proof: Proof) => {
      dispatch(checkProof())
    },
    onRevokeProof: (proof: Proof) => {
      dispatch(
        navigateAppend(
          [
            {
              props: {platform: proof.type, platformHandle: proof.name, proofId: proof.id},
              selected: 'revoke',
            },
          ],
          [profileTab]
        )
      )
    },
    onSearch: () => {
      dispatch(navigateAppend([{props: {}, selected: 'search'}]))
    },
    onUnfollow: username => {
      dispatch(onUnfollow(username))
    },
    onUserClick: username => {
      dispatch(onUserClick(username))
    },
    onViewProof: (proof: Proof) => {
      dispatch(openProofUrl(proof))
    },
    updateTrackers: username => dispatch(updateTrackers(username)),
  }),
  (stateProps, dispatchProps) => {
    const {username} = stateProps
    const refresh = () => {
      dispatchProps.getProfile(username)
      dispatchProps.updateTrackers(username)
    }
    const isYou = username === stateProps.myUsername
    const bioEditFns = isYou
      ? {
          onBioEdit: dispatchProps.onEditProfile,
          onEditAvatarClick: dispatchProps.onEditAvatar,
          onEditProfile: dispatchProps.onEditProfile,
          onLocationEdit: dispatchProps.onEditProfile,
          onNameEdit: dispatchProps.onEditProfile,
        }
      : null

    if (stateProps.trackerState && stateProps.trackerState.type !== 'tracker') {
      const propError = 'Expected a tracker type, trying to show profile for non user'
      console.warn(propError)
      return {
        propError,
        type: 'error',
        onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
      }
    }

    const okProps = {
      ...stateProps.trackerState,
      ...dispatchProps,
      bioEditFns,
      currentFriendshipsTab: stateProps.currentFriendshipsTab,
      followersLoaded: stateProps.trackerState ? stateProps.trackerState.trackersLoaded : false,
      followers: stateProps.trackerState ? stateProps.trackerState.trackers : [],
      following: stateProps.trackerState ? stateProps.trackerState.tracking : [],
      isYou,
      loading: isLoading(stateProps.trackerState) && !isTesting,
      onAcceptProofs: () => dispatchProps.onFollow(username),
      onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
      onChat: () => dispatchProps.onChat(stateProps.myUsername, username),
      onClickAvatar: () => dispatchProps.onClickAvatar(username),
      onClickFollowers: () => dispatchProps.onClickFollowers(username),
      onClickFollowing: () => dispatchProps.onClickFollowing(username),
      onFollow: () => dispatchProps.onFollow(username),
      onSearch: () => dispatchProps.onSearch(),
      onUnfollow: () => dispatchProps.onUnfollow(username),
      refresh,
      username,
    }

    return {okProps, type: 'ok'}
  }
)(ProfileContainer)
