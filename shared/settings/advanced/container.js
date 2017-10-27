// @flow
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import DBNuke from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateAppend(['dbNukeConfirm']))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(DBNuke)
