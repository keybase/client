// @flow
import Search, {type Props} from './search'
import {createShowUserProfile} from '../actions/profile-gen'
import {compose, defaultProps, connect} from '../util/container'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleInfoPanel}: Props) => ({
  onClick: username => {
    dispatch(navigateUp())
    dispatch(createShowUserProfile({username}))
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
