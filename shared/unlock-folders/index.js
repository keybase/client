// @flow

import React, {Component} from 'react'
import typedConnect, {ConnectedComponent} from '../util/typed-connect'
import HiddenString from '../util/hidden-string'

import type {State as UnlockFoldersState} from '../reducers/unlock-folders'
import type {Device, UnlockFolderActions} from '../constants/unlock-folders'
import type {TypedState} from '../constants/reducer'
import type {TypedDispatch} from '../constants/types/flux'

import * as actions from '../actions/unlock-folders'

import Render from './render'

type OwnProps = {}

export type Props = {
  devices: ?Array<Device>,
  phase: UnlockFoldersState.phase,
  close: () => void,
  toPaperKeyInput: () => void,
  onBackFromPaperKey: () => void,
  onContinueFromPaperKey: (paperkey: HiddenString) => void,
  paperkeyError: ?HiddenString,
  waiting: boolean,
  onFinish: () => void
}

class UnlockFolders extends Component<void, Props, void> {
  render () {
    return (
      <Render
        phase={this.props.phase}
        devices={this.props.devices}
        onClose={this.props.close}
        toPaperKeyInput={this.props.toPaperKeyInput}
        onBackFromPaperKey={this.props.onBackFromPaperKey}
        onContinueFromPaperKey={this.props.onContinueFromPaperKey}
        paperkeyError={this.props.paperkeyError}
        waiting={this.props.waiting}
        onFinish={this.props.onFinish}/>
    )
  }
}

type Dispatch = TypedDispatch<UnlockFolderActions>
// Annoyingly you have to assign this to a const and type it,
// otherwise flow doesn't type it quite correctly and you loose OwnProps checking
// Luckily if this declared type is wrong, flow will tell us.
const Connected: Class<ConnectedComponent<OwnProps>> = typedConnect(
  ({unlockFolders: {devices, phase, paperkeyError, waiting}}: TypedState, dispatch: Dispatch, ownProps: OwnProps): Props => ({
    close: () => { dispatch(actions.close()) },
    toPaperKeyInput: () => { dispatch(actions.toPaperKeyInput()) },
    onBackFromPaperKey: () => { dispatch(actions.onBackFromPaperKey()) },
    onContinueFromPaperKey: pk => { dispatch(actions.checkPaperKey(pk)) },
    onFinish: () => { dispatch(actions.finish()) },
    paperkeyError,
    waiting,
    devices,
    phase
  })
)(UnlockFolders)

export default Connected
