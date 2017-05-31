// @flow
import React, {Component} from 'react'
import Render from './render'
import {compose, lifecycle, withHandlers, withState} from 'recompose'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

import type {Props} from './render'

type State = {
  bio: ?string,
  fullname: ?string,
  location: ?string,
}

const _bioLengthLeft = (bio: ?string) => {
  return bio ? maxProfileBioChars - bio.length : maxProfileBioChars
}

const RenderWrapped = compose(
  withState('bio', 'onBioChange', props => props.bio),
  withState('fullname', 'onFullnameChange', props => props.fullname),
  withState('location', 'onLocationChange', props => props.location),
  withHandlers({
    onSubmit: ({bio, fullname, location, onSubmit}) => () => onSubmit({bio, fullname, location}),
  }),
  lifecycle({
    componentWillReceiveProps: function(nextProps) {
      const bioLengthLeft = _bioLengthLeft(nextProps.bio)
      this.setState({bioLengthLeft})
    },
  })
)(Render)

class EditProfile extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    const {bio, fullname, location} = this.props
    this.state = {bio, fullname, location}
  }

  render() {
    const bioLengthLeft = _bioLengthLeft(this.state.bio)
    return (
      <RenderWrapped
        bio={this.state.bio}
        bioLengthLeft={bioLengthLeft}
        fullname={this.state.fullname}
        location={this.state.location}
        onBack={this.props.onBack}
        onCancel={this.props.onBack}
        onSubmit={this.props.onEditProfile}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => {
    const userInfo = state.tracker.trackers[state.config.username].userInfo
    const {bio, fullname, location} = userInfo
    return {bio, fullname, location}
  },
  dispatch => {
    return {
      onBack: () => dispatch(navigateUp()),
      onEditProfile: (bio, fullname, location) => dispatch(editProfile(bio, fullname, location)),
    }
  },
  (stateProps, dispatchProps, ownProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onEditProfile: ({bio, fullname, location}) => {
      dispatchProps.onEditProfile(bio, fullname, location)
    },
  })
)(EditProfile)
