// @flow
import {showUserProfile} from '../actions/profile'
import {compose, defaultProps} from 'recompose'
import {connect} from 'react-redux'
import Search from './search'

import type {Props} from './search'

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
