import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

const mapStateToPropsHeaderTitle = state => Constants.getDeviceCounts(state)

export const HeaderTitle = Container.namedConnect(
  mapStateToPropsHeaderTitle,
  () => ({}),
  (s, d, o) => s,
  'DevicesHeaderTitle'
)(_HeaderTitle)

const mapDispatchToPropsHeaderRightActions = dispatch => ({
  onAdd: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deviceAdd']})),
})

export const HeaderRightActions = Container.namedConnect(
  () => ({}),
  mapDispatchToPropsHeaderRightActions,
  (s, d, o) => d,
  'DevicesHeaderRightActions'
)(_HeaderRightActions)
