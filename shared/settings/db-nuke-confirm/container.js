// @flow
import {navigateUp} from '../../actions/route-tree'
import DBNukeConfirm from './index'
import {createDbNuke} from '../../actions/settings-gen'
import {connect} from '../../util/container'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch) => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateUp())
    dispatch(createDbNuke())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(DBNukeConfirm)
