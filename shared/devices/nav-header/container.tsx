import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

export const HeaderTitle = Container.connect(
  state => Constants.getDeviceCounts(state),
  () => ({}),
  s => s
)(_HeaderTitle)

export const HeaderRightActions = Container.connect(
  () => ({}),
  dispatch => ({
    onAdd: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deviceAdd']})),
  }),
  (_, d) => d
)(_HeaderRightActions)
