// @flow
import EditProfile from '.'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'

type OwnProps = {
  routeState: {
    bio: ?string,
    location: ?string,
    fullname: ?string,
  },
}

export default connect(
  (state: TypedState, {routeState}: OwnProps) => {
    const tracker = state.tracker.trackers[state.config.username || '']
    const userInfo = tracker && tracker.type === 'tracker' && tracker.userInfo
    const bio = routeState.hasOwnProperty('bio') && routeState.bio || userInfo && userInfo.bio || ''
    const fullname = routeState.hasOwnProperty('fullname') && routeState.fullname || userInfo && userInfo.fullname
    const location = routeState.hasOwnProperty('location') && routeState.location || userInfo && userInfo.location
    const bioLengthLeft = maxProfileBioChars - bio.length
    return {bio, fullname, location, bioLengthLeft}
  },
  (dispatch: TypedDispatch<*>, {routeState, setRouteState, bio, fullname, location}) => ({
    onCancel: () => dispatch(navigateUp()),
    onBack: () => dispatch(navigateUp()),
    onSubmit: (bio, fullname, location) => dispatch(editProfile(bio, fullname, location)),
  })
)(EditProfile)
