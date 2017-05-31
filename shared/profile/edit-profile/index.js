// @flow
import React, {Component} from 'react'
import Render from './render'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

import type {Props} from './render'

class EditProfile extends Component<void, Props, void> {
  render() {
    const bioMaxChars = maxProfileBioChars
    const bioLengthLeft = bioMaxChars - this.props.bio.length
    return (
      <Render
        bio={this.props.bio}
        bioLengthLeft={bioLengthLeft}
        fullname={this.props.fullname}
        location={this.props.location}
        onBack={this.props.onBack}
        onBioChange={this.props.onBioChange}
        onCancel={this.props.onBack}
        onFullnameChange={this.props.onFullnameChange}
        onLocationChange={this.props.onLocationChange}
        onSubmit={this.props.onEditProfile}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  (state, {routeState}) => {
    const userInfo = state.tracker.trackers[state.config.username].userInfo
    return {
      bio: routeState.bio !== undefined ? routeState.bio : userInfo.bio,
      fullname: routeState.fullname !== undefined ? routeState.fullname : userInfo.fullname,
      location: routeState.location !== undefined ? routeState.location : userInfo.location,
    }
  },
  (dispatch, {routeState, setRouteState}) => {
    return {
      onBack: () => dispatch(navigateUp()),
      onBioChange: bio => {
        setRouteState({bio})
      },
      onEditProfile: (bio, fullname, location) => dispatch(editProfile(bio, fullname, location)),
      onFullnameChange: fullname => {
        setRouteState({fullname})
      },
      onLocationChange: location => {
        setRouteState({location})
      },
    }
  },
  (stateProps, dispatchProps, ownProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onEditProfile: () => {
      dispatchProps.onEditProfile(stateProps.bio, stateProps.fullname, stateProps.location)
    },
  })
)(EditProfile)
