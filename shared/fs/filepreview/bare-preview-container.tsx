import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import {getRouteProps, namedConnect, RouteProps} from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = RouteProps<{path: Types.Path}>

const ConnectedBarePreview = isMobile
  ? namedConnect(
      () => ({}),
      dispatch => ({onBack: () => dispatch(RouteTreeGen.createNavigateUp())}),
      (_, {onBack}, ownProps: OwnProps) => ({
        onBack,
        path: getRouteProps(ownProps, 'path') || Constants.defaultPath,
        routePath: I.List(), // TODO fix ownProps.routePath,
      }),
      'BarePreview'
    )(BarePreview)
  : () => null

export default ConnectedBarePreview
