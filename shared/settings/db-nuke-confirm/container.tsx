import * as RouteTreeGen from '../../actions/route-tree-gen'
import DBNukeConfirm from '.'
import {createDbNuke} from '../../actions/settings-gen'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  () => ({}),
  dispatch => ({
    onCancel: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onDBNuke: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(createDbNuke())
    },
  }),
    (_, d, __: OwnProps) => d
)(DBNukeConfirm)
