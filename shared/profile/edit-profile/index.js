/* @flow */
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {BackButton, Box, Button, Input} from '../../common-adapters'
import {globalStyles} from '../../styles/style-guide'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'

import Render from './render'
import {navigateUp} from '../../actions/router'

type State = {
  bio: string,
  fullname: string,
  location: string
}

class EditProfile extends Component<void, Props, State> {
  props: Props;
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      bio: this.props.bio,
      fullname: this.props.fullname,
      location: this.props.location,
    }
  }
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Edit profile',
        props: {},
      },
      subRoutes: {},
    }
  }

  fullnameChange (fullname) {
    this.setState({fullname})
  }

  bioChange (bio) {
    this.setState({bio})
  }

  locationChange (location) {
    this.setState({location})
  }

  onSubmit () {
    const {bio, location, fullname} = this.state
    this.props.editProfile({bio, location, fullname})
  }

  render () {
    const bioMaxChars = maxProfileBioChars
    const bioLengthLeft = bioMaxChars - this.state.bio.length
    return <Render
      fullname={this.props.fullname}
      location={this.props.location}
      bio={this.props.bio}
      fullnameChange={fullname => this.setState({fullname})}
      bioChange={bio => this.setState({bio})}
      locationChange={location => this.setState({location})}
      onBack={this.props.onBack}
      onCancel={this.props.onBack}
      onSubmit={() => this.onSubmit()}
      bioLengthLeft={bioLengthLeft}
    />
  }
}

export default connect(
  (state, ownProps) => {
    const userInfo = state.tracker.trackers[state.config.username].userInfo
    return ({
      fullname: userInfo.fullname,
      bio: userInfo.bio,
      location: userInfo.location,
    })
  },
  dispatch => {
    return {
      onBack: () => dispatch(navigateUp()),
      editProfile: ({bio, location, fullname}) => dispatch(editProfile(bio, location, fullname)),
    }
  }
)(EditProfile)
