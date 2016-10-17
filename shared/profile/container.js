// @flow
import ConfirmOrPending from './confirm-or-pending-container'
import EditAvatar from './edit-avatar-container'
import EditProfile from './edit-profile'
import ErrorComponent from '../common-adapters/error-profile'
import PostProof from './post-proof-container'
import Profile from './index'
import ProveEnterUsername from './prove-enter-username-container'
import ProveWebsiteChoice from './prove-website-choice-container'
import React, {PureComponent} from 'react'
import RevokeContainer from './revoke/container'
import flags from '../util/feature-flags'
import pgpRouter from './pgp'
import {addProof, onUserClick, onClickAvatar, onClickFollowers, onClickFollowing, checkProof} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers, onFollow, onUnfollow, openProofUrl} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {isTesting} from '../local-debug'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend, navigateUp} from '../actions/router'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {Props} from './index'

type OwnProps = {
  userOverride?: {
    username: string,
    uid: string,
  },
}

type EitherProps<P> = {
  type: 'ok',
  okProps: P,
} | {
  type: 'error',
  propError: string,
}

class ProfileContainer extends PureComponent<void, EitherProps<Props>, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Profile',
        props: {
          userOverride: currentPath.get('userOverride'),
          profileIsRoot: !!uri.count() && uri.last().get('path') === 'root',
        },
      },
      subRoutes: {
        'editprofile': EditProfile,
        'editavatar': EditAvatar,
        ProveEnterUsername,
        ProveWebsiteChoice,
        Revoke: RevokeContainer,
        PostProof,
        ConfirmOrPending,
        pgp: {
          parseRoute: () => ({parseNextRoute: pgpRouter}),
        },
      },
    }
  }

  render () {
    if (this.props.type === 'error') {
      return <ErrorComponent error={this.props.propError} />
    }

    return <Profile {...this.props.okProps} />
  }
}

export default connect(
  (state, ownProps: OwnProps) => {
    const myUsername = state.config.username
    const myUid = state.config.uid
    const username = ownProps.userOverride && ownProps.userOverride.username || myUsername
    const uid = ownProps.userOverride && ownProps.userOverride.uid || myUid

    return {
      username,
      uid,
      myUsername,
      trackerState: state.tracker.trackers[username],
    }
  },
  (dispatch: any, ownProps: OwnProps) => ({
    onUserClick: (username, uid) => { dispatch(onUserClick(username, uid)) },
    onBack: ownProps.profileIsRoot ? null : () => { dispatch(navigateUp()) },
    onFolderClick: folder => { dispatch(openInKBFS(folder.path)) },
    onEditProfile: () => { dispatch(routeAppend({path: 'editprofile'})) },
    onEditAvatar: () => { dispatch(routeAppend({path: 'editavatar'})) },
    onMissingProofClick: (missingProof: MissingProof) => { dispatch(addProof(missingProof.type)) },
    onRecheckProof: (proof: Proof) => { dispatch(checkProof(proof && proof.id)) },
    onRevokeProof: (proof: Proof) => {
      dispatch(routeAppend({path: 'Revoke', platform: proof.type, platformHandle: proof.name, proofId: proof.id}))
    },
    onViewProof: (proof: Proof) => { dispatch(openProofUrl(proof)) },
    getProfile: username => dispatch(getProfile(username)),
    updateTrackers: (username, uid) => dispatch(updateTrackers(username, uid)),
    onFollow: username => { dispatch(onFollow(username, false)) },
    onUnfollow: username => { dispatch(onUnfollow(username)) },
    onAcceptProofs: username => { dispatch(onFollow(username, false)) },
    onClickAvatar: (username, uid) => { dispatch(onClickAvatar(username, uid)) },
    onClickFollowers: (username, uid) => { dispatch(onClickFollowers(username, uid)) },
    onClickFollowing: (username, uid) => { dispatch(onClickFollowing(username, uid)) },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const refresh = () => {
      dispatchProps.getProfile(stateProps.username)
      dispatchProps.updateTrackers(stateProps.username, stateProps.uid)
    }
    const isYou = stateProps.username === stateProps.myUsername
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
      return {type: 'error', propError}
    }

    const {username, uid} = stateProps
    const okProps = {
      ...ownProps,
      ...stateProps.trackerState,
      ...dispatchProps,
      isYou,
      bioEditFns,
      username: stateProps.username,
      refresh,
      followers: stateProps.trackerState ? stateProps.trackerState.trackers : [],
      following: stateProps.trackerState ? stateProps.trackerState.tracking : [],
      loading: isLoading(stateProps.trackerState) && !isTesting,
      onFollow: username => dispatchProps.onFollow(stateProps.username),
      onUnfollow: username => dispatchProps.onUnfollow(stateProps.username),
      onAcceptProofs: username => dispatchProps.onFollow(stateProps.username),
      showComingSoon: !flags.tabProfileEnabled,
      onClickAvatar: () => dispatchProps.onClickAvatar(username, uid),
      onClickFollowers: () => dispatchProps.onClickFollowers(username, uid),
      onClickFollowing: () => dispatchProps.onClickFollowing(username, uid),
    }

    return {type: 'ok', okProps}
  }
)(ProfileContainer)
