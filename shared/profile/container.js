// @flow
import ErrorComponent from '../common-adapters/error-profile'
import Profile from './index'
import React, {PureComponent} from 'react'
import {addProof, onUserClick, onClickAvatar, onClickFollowers, onClickFollowing, checkProof} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers, onFollow, onUnfollow, openProofUrl} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {isTesting} from '../local-debug'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {openInKBFS} from '../actions/kbfs'
import {profileTab} from '../constants/tabs'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {RouteProps} from '../route-tree/render-route'
import type {Props} from './index'
import type {Tab as FriendshipsTab} from './friendships'

type OwnProps = {
  routeProps: {
    username: ?string,
    uid: ?string,
  },
} & RouteProps<{}, {currentFriendshipsTab: FriendshipsTab}>

type EitherProps<P> = {
  type: 'ok',
  okProps: P,
} | {
  type: 'error',
  propError: string,
}

type State = {
  avatarLoaded: boolean,
}

class ProfileContainer extends PureComponent<void, EitherProps<Props>, State> {
  state: State;

  constructor () {
    super()
    this.state = {avatarLoaded: false}
  }

  componentWillReceiveProps (nextProps: EitherProps<Props>) {
    if (this.props.type === 'error' || nextProps.type === 'error') {
      return
    }

    const {username} = this.props.okProps
    const {username: nextUsername} = nextProps.okProps
    if (username !== nextUsername) {
      this.setState({avatarLoaded: false})
    }
  }

  _onAvatarLoaded = () => {
    this.setState({avatarLoaded: true})
  }

  render () {
    if (this.props.type === 'error') {
      return <ErrorComponent error={this.props.propError} />
    }

    const props = this.props.okProps

    return <Profile
      {...props}
      onAvatarLoaded={this._onAvatarLoaded}
      followers={this.state.avatarLoaded ? props.followers : null}
      following={this.state.avatarLoaded ? props.following : null} />
  }
}

export default connect(
  (state, {routeProps, routeState, routePath}: OwnProps) => {
    const myUsername = state.config.username
    const myUid = state.config.uid
    const username = routeProps.username ? routeProps.username : myUsername
    // FIXME: we shouldn't be falling back to myUid here
    const uid = routeProps.username && routeProps.uid || myUid

    return {
      currentFriendshipsTab: routeState.currentFriendshipsTab,
      myUsername,
      profileIsRoot: routePath.size === 1 && routePath.first() === profileTab,
      trackerState: state.tracker.trackers[username],
      uid,
      username,
    }
  },
  (dispatch: any, {setRouteState}: OwnProps) => ({
    getProfile: username => dispatch(getProfile(username)),
    onAcceptProofs: username => { dispatch(onFollow(username, false)) },
    onBack: () => { dispatch(navigateUp()) },
    onChangeFriendshipsTab: currentFriendshipsTab => { setRouteState({currentFriendshipsTab}) },
    onClickAvatar: (username, uid) => { dispatch(onClickAvatar(username, uid)) },
    onClickFollowers: (username, uid) => { dispatch(onClickFollowers(username, uid)) },
    onClickFollowing: (username, uid) => { dispatch(onClickFollowing(username, uid)) },
    onEditAvatar: () => { dispatch(navigateAppend(['editAvatar'])) },
    onEditProfile: () => { dispatch(navigateAppend(['editProfile'])) },
    onFolderClick: folder => { dispatch(openInKBFS(folder.path)) },
    onFollow: username => { dispatch(onFollow(username, false)) },
    onMissingProofClick: (missingProof: MissingProof) => { dispatch(addProof(missingProof.type)) },
    onRecheckProof: (proof: Proof) => { dispatch(checkProof(proof && proof.id)) },
    onRevokeProof: (proof: Proof) => {
      dispatch(navigateAppend([{props: {platform: proof.type, platformHandle: proof.name, proofId: proof.id}, selected: 'revoke'}], [profileTab]))
    },
    onUnfollow: username => { dispatch(onUnfollow(username)) },
    onUserClick: (username, uid) => { dispatch(onUserClick(username, uid)) },
    onViewProof: (proof: Proof) => { dispatch(openProofUrl(proof)) },
    updateTrackers: (username, uid) => dispatch(updateTrackers(username, uid)),
  }),
  (stateProps, dispatchProps) => {
    const {username, uid} = stateProps
    if (!uid) {
      throw new Error('Attempted to render a Profile page with no uid set')
    }

    const refresh = () => {
      dispatchProps.getProfile(username)
      dispatchProps.updateTrackers(username, uid)
    }
    const isYou = username === stateProps.myUsername
    const bioEditFns = isYou ? {
      onBioEdit: dispatchProps.onEditProfile,
      onEditAvatarClick: dispatchProps.onEditAvatar,
      onEditProfile: dispatchProps.onEditProfile,
      onLocationEdit: dispatchProps.onEditProfile,
      onNameEdit: dispatchProps.onEditProfile,
    } : null

    if (stateProps.trackerState && stateProps.trackerState.type !== 'tracker') {
      const propError = 'Expected a tracker type, trying to show profile for non user'
      console.warn(propError)
      return {propError, type: 'error'}
    }

    const okProps = {
      ...stateProps.trackerState,
      ...dispatchProps,
      bioEditFns,
      currentFriendshipsTab: stateProps.currentFriendshipsTab,
      followers: stateProps.trackerState ? stateProps.trackerState.trackers : [],
      following: stateProps.trackerState ? stateProps.trackerState.tracking : [],
      isYou,
      loading: isLoading(stateProps.trackerState) && !isTesting,
      onAcceptProofs: () => dispatchProps.onFollow(username),
      onBack: stateProps.profileIsRoot ? null : dispatchProps.onBack,
      onClickAvatar: () => dispatchProps.onClickAvatar(username, uid),
      onClickFollowers: () => dispatchProps.onClickFollowers(username, uid),
      onClickFollowing: () => dispatchProps.onClickFollowing(username, uid),
      onFollow: () => dispatchProps.onFollow(username),
      onUnfollow: () => dispatchProps.onUnfollow(username),
      refresh,
      username,
    }

    return {okProps, type: 'ok'}
  }
)(ProfileContainer)
