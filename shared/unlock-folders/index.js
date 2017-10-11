// @flow
import * as Constants from '../constants/unlock-folders'
import * as Creators from '../actions/unlock-folders'
import HiddenString from '../util/hidden-string'
import React, {Component} from 'react'
import Render from './render'
import {connect, type TypedState} from '../util/container'

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

class UnlockFolders extends Component<Props> {
  render() {
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
        onFinish={this.props.onFinish}
      />
    )
  }
}

const mapStateToProps = ({unlockFolders: {devices, phase, paperkeyError, waiting}}: TypedState) => ({
  devices,
  paperkeyError,
  phase,
  waiting,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: any) => ({
  close: () => ownProps.onCancel(),
  onBackFromPaperKey: () => dispatch(Creators.onBackFromPaperKey()),
  onContinueFromPaperKey: pk => dispatch(Creators.checkPaperKey(pk)),
  onFinish: () => dispatch(Creators.finish()),
  toPaperKeyInput: () => dispatch(Creators.toPaperKeyInput()),
})

export default connect(mapStateToProps, mapDispatchToProps)(UnlockFolders)
