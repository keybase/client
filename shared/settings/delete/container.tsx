import * as RouteTreeGen from '../../actions/route-tree-gen'
import Delete from '.'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  () => ({}),
  dispatch => ({onDelete: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']}))}),
    (_, d, __: OwnProps) => d
)(Delete)
