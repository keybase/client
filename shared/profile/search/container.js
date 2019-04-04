// @flow
import Search from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import {connect, type RouteProps} from '../../util/container'

// Either onClose is passed in from bar.js or we're instantiated via a
// route.
type OwnProps = {|onClose: () => void|} | RouteProps<{}, {}>

const mapDispatchToProps = (dispatch, ownProps) => {
  const onClick = username => dispatch(createShowUserProfile({username}))
  if (ownProps.onClose) {
    // onClosed passed in, so use it.
    // $ForceType confused by non-disjoint union.
    const onClose: () => void = ownProps.onClose
    return {
      onClick,
      onClose,
    }
  } else {
    // Instantiated via route, so just navigate up on close.
    return {
      onClick,
      onClose: () => dispatch(ownProps.navigateUp()),
    }
  }
}

const mergeProps = (_, dispatchProps, ownProps) => {
  return {
    onClick: username => {
      dispatchProps.onClose()
      dispatchProps.onClick(username)
    },
    onClose: dispatchProps.onClose,
  }
}

const connected = connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  mergeProps
)(Search)

export default connected
