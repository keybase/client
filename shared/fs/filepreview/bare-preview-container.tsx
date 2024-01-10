import * as C from '@/constants'
import type * as T from '@/constants/types'
import BarePreview from './bare-preview'

type OwnProps = {path: T.FS.Path}

const ConnectedBarePreview = (ownProps: OwnProps) => {
  const path = ownProps.path ?? C.FS.defaultPath
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()
  const props = {onBack, path}
  return <BarePreview {...props} />
}

const Noop = (_: OwnProps) => {
  return null
}

export default C.isMobile ? ConnectedBarePreview : Noop
