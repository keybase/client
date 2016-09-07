// @flow
import ConfirmOrPending from './confirm-or-pending-container'
import EditProfile from './edit-profile'
import PostProof from './post-proof-container'
import ProveEnterUsername from './prove-enter-username-container'
import ProveWebsiteChoice from './prove-website-choice-container'
import React, {PureComponent} from 'react'
import Profile from './index'
import RevokeContainer from './revoke/container'
import pgpRouter from './pgp'
import {addProof, checkSpecificProof} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers, onFollow, onUnfollow, openProofUrl} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend, navigateUp} from '../actions/router'
import {isTesting} from '../local-debug'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {Props} from './index'

type OwnProps = {
  userOverride?: {
    username: string,
    uid: string,
  }
}

class ProfileContainer extends PureComponent<void, ?Props, void> {
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
    return <Profile {...this.props} />
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
      myUid,
      myUsername,
      trackerState: state.tracker.trackers[username],
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    onUserClick: (username, uid) => { dispatch(routeAppend({path: 'profile', userOverride: {username, uid}})) },
    onBack: ownProps.profileIsRoot ? null : () => { dispatch(navigateUp()) },
    onFolderClick: folder => { dispatch(openInKBFS(folder.path)) },
    onEditProfile: () => { dispatch(routeAppend({path: 'editprofile'})) },
    onMissingProofClick: (missingProof: MissingProof) => { dispatch(addProof(missingProof.type)) },
    onRecheckProof: (proof: Proof) => { dispatch(checkSpecificProof(proof && proof.id)) },
    onRevokeProof: (proof: Proof) => {
      dispatch(routeAppend({path: 'Revoke', platform: proof.type, platformHandle: proof.name, proofId: proof.id}))
    },
    onViewProof: (proof: Proof) => { dispatch(openProofUrl(proof)) },
    getProfile: username => dispatch(getProfile(username)),
    updateTrackers: (username, uid) => dispatch(updateTrackers(username, uid)),
    onFollow: username => { dispatch(onFollow(username, false)) },
    onUnfollow: username => { dispatch(onUnfollow(username)) },
    onAcceptProofs: username => { dispatch(onFollow(username, false)) },
  }),
  (stateProps, dispatchProps, ownProps) => {
    const refresh = () => {
      dispatchProps.getProfile(stateProps.username)
      dispatchProps.updateTrackers(stateProps.username, stateProps.uid)
    }
    const isYou = stateProps.username === stateProps.myUsername
    const bioEditFns = isYou ? {
      onBioEdit: dispatchProps.onEditProfile,
      onEditAvatarClick: dispatchProps.onEditProfile,
      onEditProfile: dispatchProps.onEditProfile,
      onLocationEdit: dispatchProps.onEditProfile,
      onNameEdit: dispatchProps.onEditProfile,
    } : null

    if (stateProps.trackerState && stateProps.trackerState.type !== 'tracker') {
      console.warn('Expected a tracker type, trying to show profile for non user')
      return null
    }

    return {
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
    }
  }
)(ProfileContainer)
