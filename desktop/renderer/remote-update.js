// @flow

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerUpdateListener, onCancel, onSkip, onSnooze,
  onUpdate, setAlwaysUpdate, onForce, onPauseCancel} from '../shared/actions/update.desktop'
import RemoteComponent from './remote-component'
import type {UpdateConfirmState} from '../shared/reducers/update-confirm'
import type {UpdatePausedState} from '../shared/reducers/update-paused'

type Props = {
  registerUpdateListener: () => void,
  updateConfirmState: UpdateConfirmState,
  onSkip: () => void,
  onCancel: () => void,
  onSnooze: () => void,
  onUpdate: () => void,
  setAlwaysUpdate: (alwaysUpdate: bool) => void,
  updatePausedState: UpdatePausedState,
  onForce: () => void,
  onPauseCancel: () => void
}

class RemoteUpdate extends Component<void, Props, void> {
  componentWillMount () {
    this.props.registerUpdateListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextProps.updateConfirmState !== this.props.updateConfirmState) {
      return true
    }

    if (nextProps.updatePausedState !== this.props.updatePausedState) {
      return true
    }

    return false
  }

  render () {
    return (
      <div>
        {this._renderConfirm()}
        {this._renderPaused()}
      </div>
    )
  }

  _renderConfirm () {
    const {updateConfirmState} = this.props
    if (updateConfirmState.closed) {
      return null
    }

    let updateType = 'confirm'
    let onRemoteClose = () => this.props.onCancel()
    let windowOpts = {width: 500, height: 440}
    let options = {
      onCancel: () => this.props.onCancel(),
      onSkip: () => this.props.onSkip(),
      onSnooze: () => this.props.onSnooze(),
      onUpdate: () => this.props.onUpdate(),
      setAlwaysUpdate: alwaysUpdate => this.props.setAlwaysUpdate(alwaysUpdate),
    }
    return (
      <RemoteComponent
        title='Update'
        windowsOpts={windowOpts}
        waitForState
        component='update'
        onRemoteClose={onRemoteClose}
        type={updateType}
        options={options}
      />
    )
  }

  _renderPaused () {
    const {updatePausedState} = this.props
    if (updatePausedState.closed) {
      return null
    }

    let updateType = 'paused'
    let onRemoteClose = () => this.props.onPauseCancel()
    let windowOpts = {width: 500, height: 345}
    let options = {
      onCancel: () => this.props.onPauseCancel(),
      onForce: () => this.props.onForce(),
    }

    return (
      <RemoteComponent
        title='Update'
        windowsOpts={windowOpts}
        waitForState
        component='update'
        onRemoteClose={onRemoteClose}
        type={updateType}
        options={options}
      />
    )
  }
}

export default connect(
  state => ({
    updateConfirmState: state.updateConfirm,
    updatePausedState: state.updatePaused,
  }),
  dispatch => bindActionCreators({
    registerUpdateListener,
    onCancel,
    onSkip,
    onSnooze,
    onUpdate,
    setAlwaysUpdate,
    onForce,
    onPauseCancel,
  }, dispatch)
)(RemoteUpdate)
