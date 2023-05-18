import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/fs'
import BarePreview from './bare-preview'

type OwnProps = {path: Types.Path}

const ConnectedBarePreview = (ownProps: OwnProps) => {
  const path = ownProps.path ?? Constants.defaultPath
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const props = {onBack, path}
  return <BarePreview {...props} />
}

const Noop = (_: OwnProps) => {
  return null
}

export default Container.isMobile ? ConnectedBarePreview : Noop
