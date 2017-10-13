// @flow
import {navigateUp} from '../../actions/route-tree'
import DBNukeConfirm from './index'
import {dbNuke} from '../../actions/settings'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateUp())
    dispatch(dbNuke())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(DBNukeConfirm)
