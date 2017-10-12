// @flow
import {navigateAppend} from '../../actions/route-tree'
import {clearCache} from '../../actions/settings'
import ClearCache from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClearCache: () => {
    dispatch(clearCache)
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(ClearCache)
