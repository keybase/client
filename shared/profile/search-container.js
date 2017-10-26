// @flow
import Search, {type Props} from './search'
import {showUserProfile} from '../actions/profile'
import {compose, defaultProps, connect} from '../util/container'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleInfoPanel}: Props) => ({
  onClick: username => {
    dispatch(navigateUp())
    dispatch(showUserProfile(username))
  },
  onClose: () => {
    dispatch(navigateUp())
  },
})

export default compose(
  connect(undefined, mapDispatchToProps),
  defaultProps({
    placeholder: 'Type someone',
    showAddButton: false,
  })
)(Search)
