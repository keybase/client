// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as KBFSGen from '../actions/kbfs-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as Constants from '../constants/tracker'
import * as Types from '../constants/types/tracker'
import ErrorComponent from '../common-adapters/error-profile'
import Profile from './index'
import * as React from 'react'
import {createSearchSuggestions} from '../actions/search-gen'
import {isTesting} from '../local-debug'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {peopleTab} from '../constants/tabs'
import {connect, type TypedState} from '../util/container'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {RouteProps} from '../route-tree/render-route'
import type {Props} from '.'
import type {Tab as FriendshipsTab} from './friendships'

type OwnProps = RouteProps<{username: ?string}, {currentFriendshipsTab: FriendshipsTab}>

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

class ProfileContainer extends React.PureComponent<EitherProps<Props>> {
  render() {
    if (this.props.type === 'error') {
      return <ErrorComponent error={this.props.propError} onBack={this.props.onBack} />
    }

    const props = this.props.okProps

    return <Profile {...props} followers={props.followers} following={props.following} />
  }
}

const mapStateToProps = (state: TypedState, {routeProps, routeState, routePath}: OwnProps) => {
  const myUsername = state.config.username
  const username = (routeProps.get('username') ? routeProps.get('username') : myUsername) || ''
  if (username && username !== username.toLowerCase()) {
    throw new Error('Attempted to navigate to mixed case username.')
  }
  const youAreInTeams = state.teams.getIn(['teamnames'], I.Set()).count() > 0

  return {
    currentFriendshipsTab: routeState.get('currentFriendshipsTab'),
    myUsername,
    profileIsRoot: routePath.size === 1 && routePath.first() === peopleTab,
    trackerState: state.tracker.userTrackers[username] || state.tracker.nonUserTrackers[username],
    username,
    youAreInTeams,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {setRouteState}: OwnProps) => ({
  getProfile: (username: string) => dispatch(TrackerGen.createGetProfile({username})),
  onAcceptProofs: (username: string) => dispatch(TrackerGen.createFollow({localIgnore: false, username})),
  onBack: () => dispatch(navigateUp()),
  onChangeFriendshipsTab: currentFriendshipsTab => setRouteState({currentFriendshipsTab}),
  onChat: username => dispatch(Chat2Gen.createStartConversation({participants: [username]})),
  onClickAvatar: (username: string) => dispatch(ProfileGen.createOnClickAvatar({username})),
  onClickFollowers: (username: string) => dispatch(ProfileGen.createOnClickFollowers({username})),
  onClickFollowing: (username: string) => dispatch(ProfileGen.createOnClickFollowing({username})),
  onClickShowcased: (target, team) =>
    dispatch(
      navigateAppend([
        {
          props: {position: 'bottom left', targetRect: target && target.getBoundingClientRect(), team},
          selected: 'showcasedTeamInfo',
        },
      ])
    ),
  onClickShowcaseOffer: () => dispatch(navigateAppend(['showcaseTeamOffer'])),
  onEditAvatar: () => dispatch(navigateAppend(['editAvatar'])),
  onEditProfile: () => dispatch(navigateAppend(['editProfile'])),
  onFolderClick: folder => dispatch(KBFSGen.createOpen({path: folder.path})),
  onFollow: (username: string) => dispatch(TrackerGen.createFollow({localIgnore: false, username})),
  onMissingProofClick: (missingProof: MissingProof) =>
    dispatch(ProfileGen.createAddProof({platform: missingProof.type})),
  onRecheckProof: (proof: Types.Proof) => dispatch(ProfileGen.createCheckProof()),
  onRevokeProof: (proof: Types.Proof) =>
    dispatch(
      navigateAppend(
        [
          {
            props: {platform: proof.type, platformHandle: proof.name, proofId: proof.id},
            selected: 'revoke',
          },
        ],
        [peopleTab]
      )
    ),
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
  onUnfollow: (username: string) => dispatch(TrackerGen.createUnfollow({username})),
  onUserClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onViewProof: (proof: Types.Proof) => dispatch(TrackerGen.createOpenProofUrl({proof})),
  updateTrackers: (username: string) => dispatch(TrackerGen.createUpdateTrackers({username})),
})

const mergeProps = (stateProps, dispatchProps) => {
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
    logger.warn(propError)
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
    loading: Constants.isLoading(stateProps.trackerState) && !isTesting,
    onAcceptProofs: () => dispatchProps.onFollow(username),
    onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
    onChat: () => dispatchProps.onChat(username),
    onClickAvatar: () => dispatchProps.onClickAvatar(username),
    onClickFollowers: () => dispatchProps.onClickFollowers(username),
    onClickFollowing: () => dispatchProps.onClickFollowing(username),
    onClickShowcased: (event, teamname) => dispatchProps.onClickShowcased(event, teamname),
    onClickShowcaseOffer: () => dispatchProps.onClickShowcaseOffer(),
    onFollow: () => dispatchProps.onFollow(username),
    onSearch: () => dispatchProps.onSearch(),
    onUnfollow: () => dispatchProps.onUnfollow(username),
    refresh,
    username,
    youAreInTeams: stateProps.youAreInTeams,
  }

  // TODO remove this, don't do this nested thing, just make a switching component
  return {okProps, type: 'ok'}
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ProfileContainer)
