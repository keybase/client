// @flow
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import Render from '../../login/register/paper-key/index.render'
import type {State as StoreState} from '../../reducers/unlock-folders'
import {bindActionCreators} from 'redux'
import {checkPaperKey, toPaperKeyInput, onBackFromPaperKey} from '../../actions/unlock-folders'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'

type Props = {
  error: string,
  waiting: boolean,
  onBack: () => void,
  onBackFromPaperKey: () => void,
  toPaperKeyInput: () => void,
  phase: $PropertyType<StoreState, 'phase'>,
  checkPaperKey: (paperKey: HiddenString) => void,
}

type State = {
  paperKey: string,
}

class PaperKey extends Component<void, Props, State> {
  state: State;

  constructor (props) {
    super(props)

    this.state = {
      paperKey: '',
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.phase === 'success') {
      this._onBack()
    }
  }

  _onBack () {
    this.props.onBackFromPaperKey()
    this.props.onBack()
  }

  render () {
    return <Render
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
  }

  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Paperkey',
      },
    }
  }
}

export default connect(
  (state, ownProps) => {
    return {
      waiting: state.unlockFolders.waiting,
      error: state.unlockFolders.paperkeyError || '',
      phase: state.unlockFolders.phase,
    }
  },
  dispatch => bindActionCreators({onBack: navigateUp, checkPaperKey, toPaperKeyInput, onBackFromPaperKey}, dispatch),
)(PaperKey)
