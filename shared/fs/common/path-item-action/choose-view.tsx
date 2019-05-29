import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Flow from '../../../util/flow'
import {namedConnect} from '../../../util/container'
import {FloatingMenuProps} from './types'
import Menu from './menu-container'
import Confirm from './confirm-container'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  mode: 'row' | 'screen'
  path: Types.Path
  routePath: I.List<string>
}
type StateProps = {view: Types.PathItemActionMenuView}
type Props = OwnProps & StateProps

const mapStateToProps = (state, ownProps: OwnProps) => ({
  view: state.fs.pathItemActionMenu.view,
})

const ChooseView = (props: Props) => {
  if (props.view === Types.PathItemActionMenuView.Root || props.view === Types.PathItemActionMenuView.Share) {
    return (
      <Menu
        routePath={props.routePath}
        path={props.path}
        mode={props.mode}
        floatingMenuProps={props.floatingMenuProps}
      />
    )
  } else if (
    props.view === Types.PathItemActionMenuView.ConfirmSaveMedia ||
    props.view === Types.PathItemActionMenuView.ConfirmSendToOtherApp
  ) {
    return <Confirm path={props.path} floatingMenuProps={props.floatingMenuProps} />
  } else {
    Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.view)
    return null
  }
}

export default namedConnect(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'PathItemActionChooseView'
)(ChooseView)
