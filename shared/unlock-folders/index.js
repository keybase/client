// @flow

import React, {Component} from 'react'
import typedConnect, {ConnectedComponent} from '../util/typed-connect'

import type {State as UnlockFoldersState} from '../reducers/unlock-folders'
import type {Device, UnlockFolderActions} from '../constants/unlock-folders'
import type {TypedState} from '../constants/reducer'
import type {TypedDispatch} from '../constants/types/flux'

import {close, toPaperKeyInput} from '../actions/unlock-folders'

import Render from './render'

type OwnProps = {}

export type Props = {
  devices: ?Array<Device>,
  phase: UnlockFoldersState.phase,
  close: () => void,
  toPaperKeyInput: () => void
}

class UnlockFolders extends Component<void, Props, void> {
  render () {
    return (
      <Render
        devices={this.props.devices} phase={this.props.phase}
        onClose={this.props.close}
        toPaperKeyInput={this.props.toPaperKeyInput}/>
    )
  }
}

type Dispatch = TypedDispatch<UnlockFolderActions>
// Annoyingly you have to assign this to a const and type it,
// otherwise flow doesn't type it quite correctly and you loose OwnProps checking
// Luckily if this declared type is wrong, flow will tell us.
const Connected: Class<ConnectedComponent<OwnProps>> = typedConnect(
  ({unlockFolders: {devices, phase}}: TypedState, dispatch: Dispatch, ownProps: OwnProps): Props => ({
    close: () => { dispatch(close()) },
    toPaperKeyInput: () => { dispatch(toPaperKeyInput()) },
    devices,
    phase
  })
)(UnlockFolders)

export default Connected
