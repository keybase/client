import * as RouteTreeGen from '../../actions/route-tree-gen'
import DBNukeConfirm from './index'
import {createDbNuke} from '../../actions/settings-gen'
import {connect} from '../../util/container'

type OwnProps = {}
const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onDBNuke: () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(createDbNuke())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(DBNukeConfirm)
