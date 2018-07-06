// @flow
import Search, {type Props} from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import {connect} from '../../util/container'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleInfoPanel}: Props) => ({
  onClick: username => {
    dispatch(navigateUp())
    dispatch(createShowUserProfile({username}))
  },
  onClose: () => {
    dispatch(navigateUp())
  },
})

export default connect(null, mapDispatchToProps)(Search)
