// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import {getRouteProps, namedConnect, type RouteProps} from '../../util/container'
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

const mergeProps = (stateProps, {onBack}, ownProps) => ({
  onBack,
  path: getRouteProps(ownProps, 'path') || Constants.defaultPath,
  routePath: ownProps.routePath,
})

const ConnectedBarePreview = isMobile
  ? namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'BarePreview')(BarePreview)
  : () => null

export default ConnectedBarePreview
