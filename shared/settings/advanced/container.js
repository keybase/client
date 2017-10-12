// @flow
import {navigateAppend} from '../../actions/route-tree'
import ClearCache from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onDelete: () => dispatch(navigateAppend(['clearCacheConfirm'])),
})

export default connect(mapStateToProps, mapDispatchToProps)(ClearCache)
