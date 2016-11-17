// @flow
import React, {Component} from 'react'
import Render from './render'
import {HOCForm} from '../../common-adapters'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/router'

import type {Props} from './render'

class EditProfile extends Component<void, Props, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Edit profile',
        props: {},
      },
      subRoutes: {},
    }
  }

  onSubmit () {
    // $FlowIssue
    const {bio, location, fullname} = this.props.getFormValues()
    this.props.onEditProfile({bio, location, fullname})
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
  (state, ownProps) => {
    const userInfo = state.tracker.trackers[state.config.username].userInfo
    return ({
      bio: userInfo.bio,
      fullname: userInfo.fullname,
      location: userInfo.location,
    })
  },
  dispatch => {
    return {
      onBack: () => dispatch(navigateUp()),
      onEditProfile: ({bio, fullname, location}) => dispatch(editProfile(bio, fullname, location)),
    }
  }
)(HOCForm(
  EditProfile,
  {valueName: 'bio', updateValueName: 'onBioChange'},
  {valueName: 'fullname', updateValueName: 'onFullnameChange'},
  {valueName: 'location', updateValueName: 'onLocationChange'}
))
