import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = Container.RouteProps<'barePreview'>

const ConnectedBarePreview = (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const props = {
    onBack,
    path: ownProps.route.params?.path ?? Constants.defaultPath,
  }
  return <BarePreview {...props} />
}

export default Container.isMobile ? ConnectedBarePreview : () => null
