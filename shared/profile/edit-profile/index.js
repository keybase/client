// @flow
import React, {Component} from 'react'
import Render from './render'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/router'

import type {Props} from './render'

type State = {
  bio: string,
  fullname: string,
  location: string,
}

class EditProfile extends Component<void, Props, State> {
  state: State;

  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Edit profile',
        props: {},
      },
      subRoutes: {},
    }
  }

  constructor (props: Props) {
    super(props)
    this.state = {
      bio: this.props.bio,
      fullname: this.props.fullname,
      location: this.props.location,
    }
  }

  onSubmit () {
    const {bio, location, fullname} = this.state
    this.props.onEditProfile({bio, location, fullname})
  }

  render () {
    const bioMaxChars = maxProfileBioChars
    const bioLengthLeft = bioMaxChars - this.state.bio.length
    return <Render
      bio={this.props.bio}
      bioLengthLeft={bioLengthLeft}
      fullname={this.props.fullname}
      location={this.props.location}
      onBack={this.props.onBack}
      onBioChange={bio => this.setState({bio})}
      onCancel={this.props.onBack}
      onEditProfile={this.props.onEditProfile}
      onFullnameChange={fullname => this.setState({fullname})}
      onLocationChange={location => this.setState({location})}
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
)(EditProfile)
