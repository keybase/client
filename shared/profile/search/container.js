// @flow
import Search from '.'
import {type RouteProps} from '../../route-tree/render-route'
import {createShowUserProfile} from '../../actions/profile-gen'
import {connect} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onClick: username => {
    dispatch(navigateUp())
    dispatch(createShowUserProfile({username}))
  },
  onClose: () => {
    dispatch(navigateUp())
  },
})

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Search)
