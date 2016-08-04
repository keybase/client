// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import Render from './render'
import EditProfile from './edit-profile'
import flags from '../util/feature-flags'
import {routeAppend, navigateUp} from '../actions/router'
import {openInKBFS} from '../actions/kbfs'
import * as trackerActions from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {TypedConnector} from '../util/typed-connect'

import type {Props} from './render'
import type {TypedState} from '../constants/reducer'
import type {TypedDispatch, Action} from '../constants/types/flux'

type OwnProps = {
  username?: string,
}

class Profile extends Component<void, ?Props, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Profile',
        props: {
          username: currentPath.get('username'),
          profileIsRoot: !!uri.count() && uri.last().get('path') === 'root',
        },
      },
      subRoutes: {
        'editprofile': EditProfile,
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
    trackers: state.tracker.trackers,
  }

  const username = ownProps.username || stateProps.myUsername || ''

  const {getProfile, updateTrackers, onFollow, onUnfollow} = trackerActions

  const refresh = () => {
    dispatch(getProfile(username))
    dispatch(updateTrackers(username))
  }

  const dispatchProps = {
    onUserClick: username => { dispatch(routeAppend({path: 'profile', username})) },
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
