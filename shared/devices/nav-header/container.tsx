import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

export const HeaderTitle = Container.namedConnect(
  state => Constants.getDeviceCounts(state),
  () => ({}),
  s => s,
  'DevicesHeaderTitle'
)(_HeaderTitle)

export const HeaderRightActions = Container.namedConnect(
  () => ({}),
  dispatch => ({
    onAdd: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deviceAdd']})),
  }),
  (_, d) => d,
  'DevicesHeaderRightActions'
)(_HeaderRightActions)
