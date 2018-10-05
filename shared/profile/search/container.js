// @flow
import Search from '.'
import {type RouteProps} from '../../route-tree/render-route'
import {createShowUserProfile} from '../../actions/profile-gen'
import {connect} from '../../util/container'

const mapDispatchToProps = (dispatch, {navigateUp}: RouteProps<{}, {}>) => ({
  onClick: username => {
    dispatch(navigateUp())
    dispatch(createShowUserProfile({username}))
  },
  onClose: () => {
    dispatch(navigateUp())
  },
})

export default connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Search)
