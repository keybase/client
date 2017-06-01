// @flow
import React from 'react'
import Render from './render'
import {compose, withHandlers, withPropsOnChange, withState} from 'recompose'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

import type {Props} from './render'

const RenderWrapped = compose(
  withState('bio', 'onBioChange', props => props.bio),
  withState('fullname', 'onFullnameChange', props => props.fullname),
  withState('location', 'onLocationChange', props => props.location),
  withPropsOnChange(['bio'], props => ({
    bioLengthLeft: props.bio ? maxProfileBioChars - props.bio.length : maxProfileBioChars,
  })),
  withHandlers({
    onSubmit: ({bio, fullname, location, onSubmit}) => () => onSubmit({bio, fullname, location}),
  })
)(Render)

// bio ? maxProfileBioChars - bio.length : maxProfileBioChars
const EditProfile = ({bio, fullname, location, onBack, onEditProfile}: Props) => (
  <RenderWrapped
    bio={bio}
    fullname={fullname}
    location={location}
    onBack={onBack}
    onCancel={onBack}
    onSubmit={onEditProfile}
  />
)

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
