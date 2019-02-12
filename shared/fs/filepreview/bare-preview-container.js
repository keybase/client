// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import {namedConnect, type RouteProps} from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = RouteProps<
  {|
    path: Types.Path,
  |},
  {||}
>

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, {onBack}, {routeProps, routePath}) => ({
  onBack,
  path: routeProps.get('path', Constants.defaultPath),
  routePath,
})

const ConnectedBarePreview = isMobile
  ? namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'BarePreview')(BarePreview)
  : () => null

export default ConnectedBarePreview
