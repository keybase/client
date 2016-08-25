// @flow
import ConfirmOrPending from './confirm-or-pending-container'
import EditProfile from './edit-profile'
import ErrorComponent from '../common-adapters/error-profile'
import PostProof from './post-proof-container'
import ProveEnterUsername from './prove-enter-username-container'
import ProveWebsiteChoice from './prove-website-choice-container'
import React, {PureComponent} from 'react'
import Render from './render'
import Revoke from './revoke-container'
import flags from '../util/feature-flags'
import pgpRouter from './pgp'
import {Box, Text} from '../common-adapters'
import {addProof, checkSpecificProof} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers, onFollow, onUnfollow, openProofUrl} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend, navigateUp} from '../actions/router'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {Props} from './render'

type OwnProps = {
  userOverride?: {
    username: string,
    uid: string,
  }
}

class Profile extends PureComponent<void, ?Props, void> {
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
        Revoke,
        PostProof,
        ConfirmOrPending,
        pgp: {
          parseRoute: () => ({parseNextRoute: pgpRouter}),
        },
      },
    }
  }

  componentDidMount () {
    this.props && this.props.refresh()
  }

  componentWillReceiveProps (nextProps) {
    const oldUsername = this.props && this.props.username
    if (nextProps && nextProps.username !== oldUsername) {
      nextProps.refresh()
    }
  }

  render () {
    if (this.props && this.props.error) {
      return <ErrorComponent error={this.props.error} />
    }

    return this.props ? (
      <Render
        showComingSoon={!flags.tabProfileEnabled}
        {...this.props}
        proofs={this.props.proofs || []}
        onBack={!this.props.profileIsRoot ? this.props.onBack : undefined}
      />
    ) : (
      <Box><Text type='Error'>Could not derive props; check the log</Text></Box>
    )
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
    onBack: () => { dispatch(navigateUp()) },
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
      loading: isLoading(stateProps.trackerState),
      onFollow: username => dispatchProps.onFollow(stateProps.username),
      onUnfollow: username => dispatchProps.onUnfollow(stateProps.username),
      onAcceptProofs: username => dispatchProps.onFollow(stateProps.username),
    }
  }
)(Profile)
