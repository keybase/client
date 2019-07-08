import * as RouteTreeGen from '../../actions/route-tree-gen'
import Delete from '.'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  () => ({}),
  dispatch => ({
    onDelete: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']})),
  }),
  (s, d, o) => d
)(Delete)
