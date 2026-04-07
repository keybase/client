import * as T from '@/constants/types'
import type {FloatingMenuProps} from './types'
import Menu from './menu-container'
import Confirm from './confirm'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  mode: 'row' | 'screen'
  path: T.FS.Path
  previousView: T.FS.PathItemActionMenuView
  setView: (view: T.FS.PathItemActionMenuView) => void
  view: T.FS.PathItemActionMenuView
}
const ChooseView = (props: OwnProps) => {
  switch (props.view) {
    case T.FS.PathItemActionMenuView.Root: // fallthrough
    case T.FS.PathItemActionMenuView.Share:
      return <Menu {...props} />
    case T.FS.PathItemActionMenuView.ConfirmSaveMedia: // fallthrough
    case T.FS.PathItemActionMenuView.ConfirmSendToOtherApp:
      return <Confirm {...props} />
  }
}
export default ChooseView
