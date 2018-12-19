// @flow
import {namedConnect, type RouteProps} from '../../util/container'
import {putActionIfOnPath, navigateUp} from '../../actions/route-tree'
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
  onCancel: () => dispatch(putActionIfOnPath(routePath, navigateUp())),
})

const mergeProps = (stateProps, dispatchProps, {routeProps}) => ({
  onCancel: dispatchProps.onCancel,
  path: routeProps.get('path', Constants.defaultPath),
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'OopsNoAccess')(
  OopsNoAccess
)
