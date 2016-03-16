/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onClose as trackerOnClose, startTimer as trackerStartTimer, stopTimer as trackerStopTimer} from '../shared/actions/tracker'
import {registerPinentryListener, onCancel as pinentryOnCancel, onSubmit as pinentryOnSubmit} from '../shared/actions/pinentry'
import {registerTrackerChangeListener, registerUserChangeListener} from '../shared/actions/tracker'
import {registerUpdateListener, onCancel as updateOnCancel, onSkip as updateOnSkip, onSnooze as updateOnSnooze, onUpdate as updateOnUpdate, setAlwaysUpdate} from '../shared/actions/update.desktop'
import {onForce as updateOnForce, onPauseCancel as updateOnPauseCancel} from '../shared/actions/update.desktop'
// $FlowIssue platform files
import RemoteComponent from './remote-component'

import type {GUIEntryFeatures} from '../shared/constants/types/flow-types'
import type {Action, Dispatch} from '../shared/constants/types/flux'

import type {TrackerState} from '../shared/reducers/tracker'
import type {PinentryState} from '../shared/reducers/pinentry'
import type {UpdateConfirmState} from '../shared/reducers/update-confirm'
import type {UpdatePausedState} from '../shared/reducers/update-paused'

export type RemoteManagerProps = {
  registerPinentryListener: () => void,
  registerUpdateListener: () => void,
  pinentryOnCancel: (sessionID: number) => void,
  pinentryOnSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  registerUserChangeListener: () => void,
  trackerOnClose: () => void,
  trackerServerStarted: boolean,
  trackerStartTimer: (dispatch: Dispatch, getState: any) => void,
  trackerStopTimer: () => Action,
  trackers: {[key: string]: TrackerState},
  pinentryStates: {[key: string]: PinentryState},
  updateConfirmState: UpdateConfirmState,
  updateOnSkip: () => void,
  updateOnCancel: () => void,
  updateOnSnooze: () => void,
  updateOnUpdate: () => void,
  setAlwaysUpdate: (alwaysUpdate: bool) => void,
  updatePausedState: UpdatePausedState,
  updateOnForce: () => void,
  updateOnPauseCancel: () => void
}

class RemoteManager extends Component {
  props: RemoteManagerProps;

  componentWillMount () {
    this.props.registerIdentifyUi()
    this.props.registerPinentryListener()
    this.props.registerTrackerChangeListener()
    this.props.registerUserChangeListener()
    this.props.registerUpdateListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    // different window states
    if (nextProps.trackers !== this.props.trackers) {
      return true
    }

    if (nextProps.pinentryStates !== this.props.pinentryStates) {
      return true
    }

    if (nextProps.updateConfirmState !== this.props.updateConfirmState) {
      return true
    }

    if (nextProps.updatePausedState !== this.props.updatePausedState) {
      return true
    }

    return false
  }

  trackerRemoteComponents () {
    const {trackers} = this.props
    const windowsOpts = {height: 470, width: 320}
    return Object.keys(trackers).filter(username => !trackers[username].closed).map(username => (
      <RemoteComponent
        windowsOpts={windowsOpts}
        title={`tracker - ${username}`}
        waitForState
        ignoreNewProps
        hidden={trackers[username].hidden}
        onRemoteClose={() => this.props.trackerOnClose(username)}
        component='tracker'
        username={username}
        startTimer={this.props.trackerStartTimer}
        stopTimer={this.props.trackerStopTimer}
        selectorParams={username}
        key={username} />
    ))
  }

  pinentryRemoteComponents () {
    const {pinentryStates} = this.props

    return Object.keys(pinentryStates).filter(sid => !pinentryStates[sid].closed).map(pSessionID => {
      const sid = parseInt(pSessionID, 10)
      const onCancel = () => this.props.pinentryOnCancel(sid)
      const onSubmit = this.props.pinentryOnSubmit.bind(null, sid)
      const windowsOpts = {width: 500, height: 260}
      return (
        <RemoteComponent
          title='Pinentry'
          windowsOpts={windowsOpts}
          waitForState
          onRemoteClose={onCancel}
          component='pinentry'
          key={'pinentry:' + pSessionID}
          onSubmit={onSubmit}
          onCancel={onCancel}
          sessionID={sid} />
      )
    })
  }

  showUpdateConfirmComponents () {
    const {updateConfirmState} = this.props
    if (updateConfirmState.closed) {
      return
    }

    let updateType = 'confirm'
    let onRemoteClose = () => this.props.updateOnCancel()
    let windowOpts = {width: 500, height: 440}
    let options = {
      onCancel: () => this.props.updateOnCancel(),
      onSkip: () => this.props.updateOnSkip(),
      onSnooze: () => this.props.updateOnSnooze(),
      onUpdate: () => this.props.updateOnUpdate(),
      setAlwaysUpdate: alwaysUpdate => this.props.setAlwaysUpdate(alwaysUpdate)
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

  showUpdatePausedComponents () {
    const {updatePausedState} = this.props
    if (updatePausedState.closed) {
      return
    }

    let updateType = 'paused'
    let onRemoteClose = () => this.props.updateOnPauseCancel()
    let windowOpts = {width: 500, height: 345}
    let options = {
      onCancel: () => this.props.updateOnPauseCancel(),
      onForce: () => this.props.updateOnForce()
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

  render () {
    return (
      <div style={{display: 'none'}}>
        {this.trackerRemoteComponents()}
        {this.pinentryRemoteComponents()}
        {this.showUpdateConfirmComponents()}
        {this.showUpdatePausedComponents()}
      </div>
    )
  }
}

RemoteManager.propTypes = {
  pinentryOnCancel: React.PropTypes.func,
  pinentryOnSubmit: React.PropTypes.func,
  registerPinentryListener: React.PropTypes.func,
  registerUpdateListener: React.PropTypes.func,
  registerIdentifyUi: React.PropTypes.func,
  registerTrackerChangeListener: React.PropTypes.any,
  registerUserChangeListener: React.PropTypes.any,
  trackerOnClose: React.PropTypes.func,
  trackerServerStarted: React.PropTypes.bool,
  trackerStartTimer: React.PropTypes.func,
  trackerStopTimer: React.PropTypes.func,
  trackers: React.PropTypes.any,
  pinentryStates: React.PropTypes.any,
  updateConfirmState: React.PropTypes.any,
  updateOnCancel: React.PropTypes.func,
  updateOnSkip: React.PropTypes.func,
  updateOnSnooze: React.PropTypes.func,
  updateOnUpdate: React.PropTypes.func,
  setAlwaysUpdate: React.PropTypes.func,
  updatePausedState: React.PropTypes.any,
  updateOnForce: React.PropTypes.func,
  updateOnPauseCancel: React.PropTypes.func
}

export default connect(
  state => {
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackers: state.tracker.trackers,
      pinentryStates: state.pinentry.pinentryStates || {},
      updateConfirmState: state.updateConfirm,
      updatePausedState: state.updatePaused
    }
  },
  dispatch => bindActionCreators({
    registerIdentifyUi,
    trackerStartTimer,
    trackerStopTimer,
    trackerOnClose,
    registerPinentryListener,
    registerTrackerChangeListener,
    registerUserChangeListener,
    pinentryOnCancel,
    pinentryOnSubmit,
    registerUpdateListener,
    updateOnCancel,
    updateOnSkip,
    updateOnSnooze,
    updateOnUpdate,
    setAlwaysUpdate,
    updateOnForce,
    updateOnPauseCancel
  }, dispatch)
)(RemoteManager)
