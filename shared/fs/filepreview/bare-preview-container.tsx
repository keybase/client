import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = Container.RouteProps<'barePreview'>

const ConnectedBarePreview = Container.isMobile
  ? Container.connect(
      () => ({}),
      dispatch => ({onBack: () => dispatch(RouteTreeGen.createNavigateUp())}),
      (_, {onBack}, ownProps: OwnProps) => ({
        onBack,
        path: ownProps.route.params?.path ?? Constants.defaultPath,
      })
    )(BarePreview)
  : () => null

export default ConnectedBarePreview
