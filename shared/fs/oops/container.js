// @flow
import {namedConnect, type RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import OopsNoAccess, {type What} from '.'

type OwnProps = RouteProps<
  {|
    path: Types.Path,
    what: What,
  |},
  {||}
>

const mapDispatchToProps = (dispatch, {routePath}) => ({
  onCancel: () =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, {routeProps}) => ({
  onCancel: dispatchProps.onCancel,
  path: routeProps.get('path', Constants.defaultPath),
  what: routeProps.get('what', 'non-existent'),
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'OopsNoAccess')(
  OopsNoAccess
)
