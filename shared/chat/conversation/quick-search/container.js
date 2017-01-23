// @flow
import QuickSearch from '.'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

export default connect(
  () => ({}),
  (dispatch: Dispatch) => ({
    onClose: () => dispatch(navigateUp()),
  })
)(QuickSearch)
