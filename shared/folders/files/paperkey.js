// @flow
import * as Constants from '../../constants/unlock-folders'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import Render from '../../login/register/paper-key/index.render'
import {checkPaperKey, toPaperKeyInput, onBackFromPaperKey} from '../../actions/unlock-folders'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

type Props = {
  error: string,
  waiting: boolean,
  onBack: () => void,
  onBackFromPaperKey: () => void,
  toPaperKeyInput: () => void,
  phase: $PropertyType<Constants.State, 'phase'>,
  checkPaperKey: (paperKey: HiddenString) => void,
}

class PaperKey extends Component<void, Props, {paperKey: string}> {
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
      <Render
        onSubmit={() => {
          this.props.toPaperKeyInput()
          this.props.checkPaperKey(new HiddenString(this.state.paperKey))
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

export default connect(
  (state: TypedState, ownProps) => {
    return {
      waiting: state.unlockFolders.waiting,
      error: state.unlockFolders.paperkeyError || '',
      phase: state.unlockFolders.phase,
    }
  },
  (dispatch: any) => ({
    onBack: () => {
      dispatch(navigateUp())
    },
    checkPaperKey: paperkey => {
      dispatch(checkPaperKey(paperkey))
    },
    toPaperKeyInput: () => {
      dispatch(toPaperKeyInput())
    },
    onBackFromPaperKey: () => {
      dispatch(onBackFromPaperKey())
    },
  })
)(PaperKey)
