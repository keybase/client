import * as Types from '../../../constants/types/fs'
import * as C from '../../../constants'
import type {FloatingMenuProps} from './types'
import Menu from './menu-container'
import Confirm from './confirm-container'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  mode: 'row' | 'screen'
  path: Types.Path
}
type StateProps = {view: Types.PathItemActionMenuView}
type Props = OwnProps & StateProps

const ChooseView = (props: Props) => {
  if (props.view === Types.PathItemActionMenuView.Root || props.view === Types.PathItemActionMenuView.Share) {
    return <Menu path={props.path} mode={props.mode} floatingMenuProps={props.floatingMenuProps} />
  } else if (
    props.view === Types.PathItemActionMenuView.ConfirmSaveMedia ||
    props.view === Types.PathItemActionMenuView.ConfirmSendToOtherApp
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
