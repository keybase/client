// @flow
import {navigateAppend} from '../../actions/route-tree'
import Delete from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onDelete: () => dispatch(navigateAppend(['deleteConfirm'])),
})

export default connect(mapStateToProps, mapDispatchToProps)(Delete)
