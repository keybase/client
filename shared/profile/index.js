// @flow
import EditProfile from './edit-profile'
import React, {Component} from 'react'
import Render from './render'
import flags from '../util/feature-flags'
import type {MissingProof} from '../common-adapters/user-proofs'
import type {Props} from './render'
import {addProof} from '../actions/profile'
import {connect} from 'react-redux'
import {getProfile, updateTrackers} from '../actions/tracker'
import {isLoading} from '../constants/tracker'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend, navigateUp} from '../actions/router'
import ProveEnterUsername from './prove-enter-username-container'

class Profile extends Component<void, Props, void> {
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
        ProveEnterUsername,
      },
    }
  }

  componentDidMount () {
    this.props.refresh(this.props.username)
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.username !== this.props.username) {
      this.props.refresh(nextProps.username)
    }
  }

  render () {
    return (
      <Render
        showComingSoon={!flags.tabProfileEnabled}
        {...this.props}
        proofs={this.props.proofs || []}
        loading={this.props.loading}
        onBack={!this.props.profileIsRoot ? this.props.onBack : undefined}
        followers={this.props.trackers || []}
        following={this.props.tracking || []}
      />
    )
  }
}

export default connect(
  state => ({
    myUsername: state.config.username,
    trackers: state.tracker.trackers,
  }),
  dispatch => ({
    refresh: username => {
      dispatch(getProfile(username))
      dispatch(updateTrackers(username))
    },
    onUserClick: username => { dispatch(routeAppend({path: 'profile', username})) },
    onBack: () => dispatch(navigateUp()),
    onFolderClick: folder => dispatch(openInKBFS(folder.path)),
    onEditProfile: () => dispatch(routeAppend({path: 'editprofile'})),
    onMissingProofClick: (missingProof: MissingProof) => dispatch(addProof(missingProof.type)),
  }),
  (stateProps, dispatchProps, ownProps) => {
    const username = ownProps.username || stateProps.myUsername
    const isYou = username === stateProps.myUsername
    const onEditProfile = () => dispatchProps.onEditProfile()
    const bioEditFns = isYou && {
      onBioEdit: onEditProfile,
      onEditAvatarClick: onEditProfile,
      onEditProfile: onEditProfile,
      onLocationEdit: onEditProfile,
      onNameEdit: onEditProfile,
    }

    return {
      ...ownProps,
      ...stateProps.trackers[username],
      ...dispatchProps,
      isYou,
      bioEditFns,
      username,
      refresh: username => dispatchProps.refresh(username),
      loading: isLoading(stateProps.trackers[username]),
    }
  }
)(Profile)
