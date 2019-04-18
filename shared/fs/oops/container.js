// @flow
import {getRouteProps, namedConnect, type RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import OopsNoAccess, {type Reason} from '.'

type OwnProps = RouteProps<
  {|
    path: Types.Path,
    reason: Reason,
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onCancel: dispatchProps.onCancel,
  path: getRouteProps(ownProps, 'path') || Constants.defaultPath,
  reason: getRouteProps(ownProps, 'reason') || 'non-existent',
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'OopsNoAccess')(
  OopsNoAccess
)
