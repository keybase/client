// @flow
import logger from '../logger'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
import * as TrackerGen from '../actions/tracker-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as Constants from '../constants/tracker'
import * as TrackerTypes from '../constants/types/tracker'
import * as Types from '../constants/types/profile'
import * as WalletsGen from '../actions/wallets-gen'
import {noAccountID, type CounterpartyType} from '../constants/types/wallets'
import {isInSomeTeam} from '../constants/teams'
import ErrorComponent from './error-profile'
import Profile from './index'
import * as React from 'react'
import {createSearchSuggestions} from '../actions/search-gen'
import {isTesting} from '../local-debug'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {peopleTab} from '../constants/tabs'
import {connect} from '../util/container'
import flags from '../util/feature-flags'

import type {Response} from 'react-native-image-picker'
import type {MissingProof} from '../common-adapters/user-proofs'
import type {RouteProps} from '../route-tree/render-route'
import type {Props} from '.'
import * as ConfigGen from '../actions/config-gen'

type OwnProps = RouteProps<{username: ?string}, {currentFriendshipsTab: Types.FriendshipsTab}>

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

const mapStateToProps = (state, {routeProps, routeState, routePath}: OwnProps) => {
  const myUsername = state.config.username
  const username = (routeProps.get('username') ? routeProps.get('username') : myUsername) || ''
  if (username && username !== username.toLowerCase()) {
    throw new Error('Attempted to navigate to mixed case username.')
  }
  const youAreInTeams = isInSomeTeam(state)

  return {
    addUserToTeamsResults: state.teams.addUserToTeamsResults,
    currentFriendshipsTab: routeState.get('currentFriendshipsTab'),
    myUsername,
    profileIsRoot: routePath.size === 1 && routePath.first() === peopleTab,
    // TODO: use real federated stellar address
    stellarAddress: flags.walletsEnabled ? username + '*keybase.io' : '',
    trackerState: state.tracker.userTrackers[username] || state.tracker.nonUserTrackers[username],
    username,
    youAreInTeams,
  }
}

const mapDispatchToProps = (dispatch, {setRouteState}: OwnProps) => ({
  _copyStellarAddress: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
  _onAddToTeam: (username: string) => dispatch(navigateAppend([{props: {username}, selected: 'addToTeam'}])),
  _onBrowsePublicFolder: (username: string) =>
    dispatch(FsGen.createOpenPathInFilesTab({path: FsTypes.stringToPath(`/keybase/public/${username}`)})),
  _onChat: (username: string) =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'profile'})),
  _onClickAvatar: (username: string) => dispatch(ProfileGen.createOnClickAvatar({username})),
  _onClickFollowers: (username: string) => dispatch(ProfileGen.createOnClickFollowers({username})),
  _onClickFollowing: (username: string) => dispatch(ProfileGen.createOnClickFollowing({username})),
  _onFollow: (username: string) => dispatch(TrackerGen.createFollow({localIgnore: false, username})),
  _onOpenPrivateFolder: (myUsername: string, theirUsername: string) =>
    dispatch(
      FsGen.createOpenPathInFilesTab({
        path: FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`),
      })
    ),
  _onSendOrRequestLumens: (to: string, isRequest, recipientType: CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: noAccountID,
        isRequest,
        recipientType,
        to,
      })
    )
  },
  _onUnfollow: (username: string) => dispatch(TrackerGen.createUnfollow({username})),
  getProfile: (username: string) => dispatch(TrackerGen.createGetProfile({username})),
  onBack: () => dispatch(navigateUp()),
  onChangeFriendshipsTab: currentFriendshipsTab => setRouteState({currentFriendshipsTab}),
  onClearAddUserToTeamsResults: () => dispatch(TeamsGen.createSetAddUserToTeamsResults({results: ''})),
  onClickShowcaseOffer: () => dispatch(navigateAppend(['showcaseTeamOffer'])),
  onEditAvatar: (image?: Response) =>
    flags.avatarUploadsEnabled
      ? dispatch(navigateAppend([{props: {image}, selected: 'editAvatar'}]))
      : dispatch(navigateAppend(['editAvatarPlaceholder'])),
  onEditProfile: () => dispatch(navigateAppend(['editProfile'])),
  onFolderClick: folder =>
    dispatch(FsGen.createOpenPathInFilesTab({path: FsTypes.stringToPath(folder.path)})),
  onMissingProofClick: (missingProof: MissingProof) =>
    dispatch(ProfileGen.createAddProof({platform: missingProof.type})),
  onRecheckProof: (proof: TrackerTypes.Proof) => dispatch(ProfileGen.createCheckProof()),
  onRevokeProof: (proof: TrackerTypes.Proof) =>
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
  onUserClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onViewProof: (proof: TrackerTypes.Proof) => dispatch(TrackerGen.createOpenProofUrl({proof})),
  updateTrackers: (username: string) => dispatch(TrackerGen.createUpdateTrackers({username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const username = stateProps.username || ''
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
      onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
      propError,
      type: 'error',
    }
  }

  // TODO entirely change how this works
  const okProps = {
    ...stateProps.trackerState,
    ...dispatchProps,
    addUserToTeamsResults: stateProps.addUserToTeamsResults,
    bioEditFns,
    currentFriendshipsTab: stateProps.currentFriendshipsTab,
    followers: stateProps.trackerState ? stateProps.trackerState.trackers : [],
    followersLoaded: (stateProps.trackerState ? stateProps.trackerState.trackersLoaded : false) || false,
    following: stateProps.trackerState ? stateProps.trackerState.tracking : [],
    isYou,
    loading: Constants.isLoading(stateProps.trackerState) && !isTesting,
    onAcceptProofs: () => dispatchProps._onFollow(username),
    onAddToTeam: () => dispatchProps._onAddToTeam(username),
    onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
    onBrowsePublicFolder: () => dispatchProps._onBrowsePublicFolder(username),
    onChat: () => dispatchProps._onChat(username),
    onClearAddUserToTeamsResults: () => dispatchProps.onClearAddUserToTeamsResults(),
    onClickAvatar: () => dispatchProps._onClickAvatar(username),
    onClickFollowers: () => dispatchProps._onClickFollowers(username),
    onClickFollowing: () => dispatchProps._onClickFollowing(username),
    onClickShowcaseOffer: () => dispatchProps.onClickShowcaseOffer(),
    onCopyStellarAddress: () => dispatchProps._copyStellarAddress(stateProps.stellarAddress),
    onFollow: () => dispatchProps._onFollow(username),
    onOpenPrivateFolder: () => {
      stateProps.myUsername && dispatchProps._onOpenPrivateFolder(stateProps.myUsername || '', username || '')
    },
    onRequestLumens: () => dispatchProps._onSendOrRequestLumens(username, true, 'keybaseUser'),
    onSearch: () => dispatchProps.onSearch(),
    onSendLumens: () => dispatchProps._onSendOrRequestLumens(username, false, 'keybaseUser'),
    // TODO: shouldn't there be 'stellarFederatedAddress'?
    onSendOrRequestStellarAddress: (isRequest: boolean) =>
      dispatchProps._onSendOrRequestLumens(stateProps.stellarAddress, isRequest, 'stellarPublicKey'),
    onUnfollow: () => dispatchProps._onUnfollow(username),
    refresh,
    stellarAddress: stateProps.stellarAddress ? stateProps.stellarAddress : '',
    username,
    youAreInTeams: stateProps.youAreInTeams,
  }

  // TODO remove this, don't do this nested thing, just make a switching component
  return {okProps, type: 'ok'}
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ProfileContainer)
