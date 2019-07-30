import Search from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'

type OwnProps = {onClose?: () => void}

const connected = connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    onClose: ownProps.onClose || (() => dispatch(RouteTreeGen.createNavigateUp())),
  }),
  (_, dispatchProps, __: OwnProps) => ({
    onClick: (username: string) => {
      dispatchProps.onClose()
      dispatchProps.onClick(username)
    },
    onClose: dispatchProps.onClose,
  })
)(Search)

export default connected
