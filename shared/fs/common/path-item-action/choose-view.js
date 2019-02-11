// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Flow from '../../../util/flow'
import {namedConnect} from '../../../util/container'
import type {FloatingMenuProps} from './types'
import Menu from './menu-container'
import Confirm from './confirm-container'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapStateToProps = state => ({
  view: state.fs.pathItemActionMenu.view,
})

const ChooseView = props => {
  if (props.view === 'root' || props.view === 'share') {
    return <Menu routePath={props.routePath} path={props.path} floatingMenuProps={props.floatingMenuProps} />
  } else if (props.view === 'confirm-save-media' || props.view === 'confirm-send-to-other-app') {
    return <Confirm path={props.path} floatingMenuProps={props.floatingMenuProps} />
  } else {
    Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.view)
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'PathItemActionChooseView'
)(ChooseView)
