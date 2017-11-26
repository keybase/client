// @flow
import * as Types from '../constants/types/unlock-folders'
import * as Creators from '../actions/unlock-folders'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import HiddenString from '../util/hidden-string'
import React, {Component} from 'react'
import Render from './render'
import {connect, type TypedState} from '../util/container'

export type Props = {
  devices: ?Array<Types.Device>,
  phase: $PropertyType<Types.State, 'phase'>,
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
  onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
  onContinueFromPaperKey: pk => dispatch(Creators.checkPaperKey(pk)),
  onFinish: () => dispatch(UnlockFoldersGen.createFinish()),
  toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
})

export default connect(mapStateToProps, mapDispatchToProps)(UnlockFolders)
