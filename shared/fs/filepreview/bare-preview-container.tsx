import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = Container.RouteProps2<'barePreview'>

const ConnectedBarePreview = (ownProps: OwnProps) => {
  const path = ownProps.route.params.path ?? Constants.defaultPath
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const props = {onBack, path}
  return <BarePreview {...props} />
}

export default Container.isMobile ? ConnectedBarePreview : () => null
