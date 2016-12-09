// @flow
import Render from '.'
import {compose, withState, withProps, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

export default compose(
  withState('fullnameCache', 'onFullnameChange', ''),
  withState('locationCache', 'onLocationChange', ''),
  withState('bioCache', 'onBioChange', ''),
  lifecycle({
    componentWillUnmount: function () {
      // console.log('aaaa lifecylcle unmount', this.props)
      this.props.setRouteState({
        fullname: this.props.fullnameCache,
        location: this.props.locationCache,
        bio: this.props.bioCache,
      })
    },
  }),
  // $FlowIssue TODO type this
  connect(
    (state, {routeState, fullnameCache, locationCache, bioCache, ...rest}) => {
      const userInfo = state.tracker.trackers[state.config.username].userInfo
      const bio = bioCache || routeState.bio || userInfo.bio
      const fullname = fullnameCache || routeState.fullname || userInfo.fullname
      const location = locationCache || routeState.location || userInfo.location
      const props = {
        bio,
        fullname,
        location,
        bioLengthLeft: maxProfileBioChars - bio.length,
      }

      // console.log('aaaa connect state', props, rest)
      return props
    },
    (dispatch, {routeState, setRouteState, bioCache, fullnameCache, locationCache}) => ({
      onCancel: () => dispatch(navigateUp()),
      onBack: () => dispatch(navigateUp()),
      onSubmit: () => dispatch(editProfile(bioCache, fullnameCache, locationCache)),
    })
  )
)(Render)
