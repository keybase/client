// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Flow from '../../../util/flow'
import {namedConnect} from '../../../util/container'
import type {FloatingMenuProps} from './types'
import Root from './root-container'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
|}

const mapStateToProps = state => ({
  view: state.fs.actionMenu.view,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'PathItemActionChooseView'
)(props => {
  switch (props.view) {
    case 'root':
      return <Root path={props.path} floatingMenuProps={props.floatingMenuProps} />
    case 'share':
      return <Root path={props.path} floatingMenuProps={props.floatingMenuProps} />
    case 'confirm-download':
      return <Root path={props.path} floatingMenuProps={props.floatingMenuProps} />
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.view)
      return null
  }
})
