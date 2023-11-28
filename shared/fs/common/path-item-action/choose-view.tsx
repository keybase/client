import * as T from '@/constants/types'
import * as C from '@/constants'
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
  switch (props.view) {
    case T.FS.PathItemActionMenuView.Root: // fallthrough
    case T.FS.PathItemActionMenuView.Share:
      return <Menu path={props.path} mode={props.mode} floatingMenuProps={props.floatingMenuProps} />
    case T.FS.PathItemActionMenuView.ConfirmSaveMedia: // fallthrough
    case T.FS.PathItemActionMenuView.ConfirmSendToOtherApp:
      return <Confirm path={props.path} floatingMenuProps={props.floatingMenuProps} />
  }
}

const Container = (ownProps: OwnProps) => {
  const view = C.useFSState(s => s.pathItemActionMenu.view)
  const props = {
    ...ownProps,
    view,
  }
  return <ChooseView {...props} />
}

export default Container
