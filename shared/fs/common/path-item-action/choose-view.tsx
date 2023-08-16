import * as T from '../../../constants/types'
import * as C from '../../../constants'
import type {FloatingMenuProps} from './types'
import Menu from './menu-container'
import Confirm from './confirm-container'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  mode: 'row' | 'screen'
  path: T.FS.Path
}
type StateProps = {view: T.FS.PathItemActionMenuView}
type Props = OwnProps & StateProps

const ChooseView = (props: Props) => {
  if (props.view === T.FS.PathItemActionMenuView.Root || props.view === T.FS.PathItemActionMenuView.Share) {
    return <Menu path={props.path} mode={props.mode} floatingMenuProps={props.floatingMenuProps} />
  } else if (
    props.view === T.FS.PathItemActionMenuView.ConfirmSaveMedia ||
    props.view === T.FS.PathItemActionMenuView.ConfirmSendToOtherApp
  ) {
    return <Confirm path={props.path} floatingMenuProps={props.floatingMenuProps} />
  } else {
    return null
  }
}

export default (ownProps: OwnProps) => {
  const view = C.useFSState(s => s.pathItemActionMenu.view)
  const props = {
    ...ownProps,
    view,
  }
  return <ChooseView {...props} />
}
