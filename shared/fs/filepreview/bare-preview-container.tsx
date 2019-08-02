import * as Types from '../../constants/types/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = Container.RouteProps<{path: Types.Path}>

const ConnectedBarePreview = Container.isMobile
  ? Container.namedConnect(
      () => ({}),
      dispatch => ({onBack: () => dispatch(RouteTreeGen.createNavigateUp())}),
      (_, {onBack}, ownProps: OwnProps) => ({
        onBack,
        path: Container.getRouteProps(ownProps, 'path', Constants.defaultPath),
      }),
      'BarePreview'
    )(BarePreview)
  : () => null

export default ConnectedBarePreview
