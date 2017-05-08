// @flow
import * as Constants from '../constants/unlock-folders'
import * as actions from '../actions/unlock-folders'
import HiddenString from '../util/hidden-string'
import React, {Component} from 'react'
import Render from './render'
import {TypedConnector} from '../util/typed-connect'

import type {TypedState} from '../constants/reducer'
import type {TypedDispatch} from '../constants/types/flux'

type OwnProps = {
  onCancel: () => void,
}

export type Props = {
  devices: ?Array<Constants.Device>,
  phase: $PropertyType<Constants.State, 'phase'>,
  close: () => void,
  toPaperKeyInput: () => void,
  onBackFromPaperKey: () => void,
  onContinueFromPaperKey: (paperkey: HiddenString) => void,
  paperkeyError: ?string,
  waiting: boolean,
  onFinish: () => void,
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
        onFinish={this.props.onFinish} />
    )
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<Constants.Actions>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({unlockFolders: {devices, phase, paperkeyError, waiting}}, dispatch, ownProps) => ({
    close: () => { ownProps.onCancel() },
    toPaperKeyInput: () => { dispatch(actions.toPaperKeyInput()) },
    onBackFromPaperKey: () => { dispatch(actions.onBackFromPaperKey()) },
    onContinueFromPaperKey: pk => { dispatch(actions.checkPaperKey(pk)) },
    onFinish: () => { dispatch(actions.finish()) },
    paperkeyError,
    waiting,
    devices,
    phase,
  }))(UnlockFolders)

export function selector (): (store: Object) => ?Object {
  return store => ({unlockFolders: store.unlockFolders})
}
