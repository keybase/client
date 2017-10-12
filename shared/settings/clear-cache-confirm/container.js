// @flow
import {navigateUp} from '../../actions/route-tree'
import ClearCacheConfirm from './index'
import {clearCache} from '../../actions/settings'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
  onClearCache: () => {
    dispatch(navigateUp())
    dispatch(clearCache())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(ClearCacheConfirm)
