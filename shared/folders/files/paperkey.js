// @flow
import * as Types from '../../constants/types/unlock-folders'
import * as UnlockFoldersGen from '../../actions/unlock-folders-gen'
import React, {Component} from 'react'
import PaperKey from '../../login/register/paper-key'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

type Props = {
  error: string,
  waiting: boolean,
  onBack: () => void,
  onBackFromPaperKey: () => void,
  toPaperKeyInput: () => void,
  phase: $PropertyType<Types.State, 'phase'>,
  checkPaperKey: (paperKey: string) => void,
}

// TODO remove this class
class _PaperKey extends Component<Props, {paperKey: string}> {
  state = {
    paperKey: '',
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.phase === 'success') {
      this._onBack()
    }
  }

  _onBack() {
    this.props.onBackFromPaperKey()
    this.props.onBack()
  }

  render() {
    return (
      <PaperKey
        onSubmit={() => {
          this.props.toPaperKeyInput()
          this.props.checkPaperKey(this.state.paperKey)
        }}
        error={this.props.error}
        onChangePaperKey={paperKey => this.setState({paperKey})}
        onBack={() => this._onBack()}
        paperKey={this.state.paperKey}
        waitingForResponse={this.props.waiting}
      />
    )
  }
}

const mapStateToProps = (state: TypedState, ownProps) => ({
  waiting: state.unlockFolders.waiting,
  error: state.unlockFolders.paperkeyError || '',
  phase: state.unlockFolders.phase,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  checkPaperKey: (paperKey: string) => dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey})),
  toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
  onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
})

export default connect(mapStateToProps, mapDispatchToProps)(_PaperKey)
