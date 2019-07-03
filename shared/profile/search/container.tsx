import Search from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import {createNavigateUp} from '../../actions/route-tree-gen'
import {connect} from '../../util/container'

type OwnProps = {
  onClose?: () => void
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onClick: username => dispatch(createShowUserProfile({username})),
  onClose: ownProps.onClose || (() => dispatch(createNavigateUp())),
})

const mergeProps = (_, dispatchProps, ownProps) => {
  return {
    onClick: username => {
      dispatchProps.onClose()
      dispatchProps.onClick(username)
    },
    onClose: dispatchProps.onClose,
  }
}

const connected = connect(
  () => ({}),
  mapDispatchToProps,
  mergeProps
)(Search)

export default connected
