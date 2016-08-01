// @flow
import * as trackerActions from '../actions/tracker'
import ConfirmOrPending from './confirm-or-pending-container'
import EditProfile from './edit-profile'
import PostProof from './post-proof-container'
import ProveEnterUsername from './prove-enter-username-container'
import React, {Component} from 'react'
import Render from './render'
import Revoke from './revoke-container'
import flags from '../util/feature-flags'
import type {Props} from './render'
import type {TypedDispatch, Action} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'
import {Box, Text} from '../common-adapters'
import {TypedConnector} from '../util/typed-connect'
import {isLoading} from '../constants/tracker'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend, navigateUp} from '../actions/router'

const {getProfile, updateTrackers, onFollow, onUnfollow} = trackerActions

type OwnProps = {
  userOverride?: {
    username: string,
    uid: string,
  }
}

class Profile extends Component<void, ?Props, void> {
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
        Revoke,
        PostProof,
        ConfirmOrPending,
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

const connector: TypedConnector<TypedState, TypedDispatch<Action>, OwnProps, ?Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  const stateProps = {
    myUsername: state.config.username,
    myUid: state.config.uid,
    trackers: state.tracker.trackers,
  }

  const {username, uid} = ownProps.userOverride ? ownProps.userOverride : {
    username: stateProps.myUsername || '',
    uid: stateProps.myUid || '',
  }

  const refresh = () => {
    dispatch(getProfile(username))
    dispatch(updateTrackers(username, uid))
  }

  const dispatchProps = {
    onUserClick: (username, uid) => { dispatch(routeAppend({path: 'profile', userOverride: {username, uid}})) },
    onBack: () => { dispatch(navigateUp()) },
    onFolderClick: folder => { dispatch(openInKBFS(folder.path)) },
    onEditProfile: () => { dispatch(routeAppend({path: 'editprofile'})) },
    onFollow: () => { dispatch(onFollow(username, false)) },
    onUnfollow: () => { dispatch(onUnfollow(username)) },
    onAcceptProofs: () => { dispatch(onFollow(username, false)) },
  }

  const onMissingProofClick = () => { console.log('TODO onMissingProofClick') }

  const isYou = username === stateProps.myUsername
  const onEditProfile = () => { dispatchProps.onEditProfile() }
  const bioEditFns = isYou ? {
    onBioEdit: onEditProfile,
    onEditAvatarClick: onEditProfile,
    onEditProfile: onEditProfile,
    onLocationEdit: onEditProfile,
    onNameEdit: onEditProfile,
    onMissingProofClick,
  } : null

  const trackerState = stateProps.trackers[username]

  if (trackerState && trackerState.type !== 'tracker') {
    console.warn('Expected a tracker type, trying to show profile for non user')
    return null
  }

  return {
    ...ownProps,
    ...trackerState,
    ...dispatchProps,
    isYou,
    bioEditFns,
    username,
    refresh,
    followers: trackerState ? trackerState.trackers : [],
    following: trackerState ? trackerState.tracking : [],
    onMissingProofClick,
    onRecheckProof: () => console.log('TODO'),
    onRevokeProof: () => console.log('TODO'),
    onViewProof: () => console.log('TODO'),
    loading: isLoading(trackerState),
  }
})(Profile)
