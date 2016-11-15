// @flow
import React, {Component} from 'react'
import Render from './render'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

import type {Props} from './render'

class EditProfile extends Component<void, Props, void> {
  onSubmit () {
    this.props.onEditProfile()
  }

  render () {
    const bioMaxChars = maxProfileBioChars
    const bioLengthLeft = bioMaxChars - this.props.bio.length
    return <Render
      bio={this.props.bio}
      bioLengthLeft={bioLengthLeft}
      fullname={this.props.fullname}
      location={this.props.location}
      onBack={this.props.onBack}
      onBioChange={this.props.onBioChange}
      onCancel={this.props.onBack}
      onEditProfile={this.props.onEditProfile}
      onFullnameChange={this.props.onFullnameChange}
      onLocationChange={this.props.onLocationChange}
      onSubmit={() => this.onSubmit()}
    />
  }
}

// $FlowIssue type this connector
export default connect(
  (state, {routeState}) => {
    const userInfo = state.tracker.trackers[state.config.username].userInfo
    return ({
      bio: routeState.bio || userInfo.bio,
      fullname: routeState.fullname || userInfo.fullname,
      location: routeState.location || userInfo.location,
    })
  },
  (dispatch, {routeState, setRouteState}) => {
    return {
      onBack: () => dispatch(navigateUp()),
      onBioChange: bio => { setRouteState({bio}) },
      onFullnameChange: fullname => { setRouteState({fullname}) },
      onLocationChange: location => { setRouteState({location}) },
      onEditProfile: () => dispatch(editProfile(routeState.bio, routeState.fullname, routeState.location)),
    }
  }
)(EditProfile)
