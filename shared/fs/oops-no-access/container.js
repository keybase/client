// @flow
import {namedConnect, type RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import OopsNoAccess from '.'

type OwnProps = RouteProps<
  {|
    path: Types.Path,
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
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'OopsNoAccess')(
  OopsNoAccess
)
