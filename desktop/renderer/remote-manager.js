/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerIdentifyUi} from '../shared/actions/tracker'
import {registerPinentryListener, onCancel as pinentryOnCancel, onSubmit as pinentryOnSubmit} from '../shared/actions/pinentry'
import {registerTrackerChangeListener} from '../shared/actions/tracker'
import {registerUpdateListener, onCancel as updateOnCancel, onSkip as updateOnSkip, onSnooze as updateOnSnooze, onUpdate as updateOnUpdate, setAlwaysUpdate} from '../shared/actions/update'
import {onForce as updateOnForce, onPauseCancel as updateOnPauseCancel} from '../shared/actions/update'
// $FlowIssue platform files
import RemoteComponent from './remote-component'
import {remoteComponentProps as trackerComponentProps, remoteComponentActions as trackerRemoteComponentActions} from '../shared/tracker'
import {remoteComponentProps as pinentryComponentProps} from '../shared/pinentry'
import {remoteComponentPropsUpdate, remoteComponentPropsPaused} from '../shared/update'

import type {GUIEntryFeatures} from '../shared/constants/types/flow-types'

import type {TrackerState} from '../shared/reducers/tracker'
import type {RemoteActions as TrackerRemoteActions} from '../shared/tracker'
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
  trackerServerStarted: boolean,
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
  updateOnPauseCancel: () => void,
  trackerActions: TrackerRemoteActions
}

class RemoteManager extends Component {
  props: RemoteManagerProps;

  componentWillMount () {
    this.props.registerIdentifyUi()
    this.props.registerPinentryListener()
    this.props.registerTrackerChangeListener()
    this.props.registerUpdateListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    // different window states
    return nextProps.trackers !== this.props.trackers ||
      nextProps.pinentryStates !== this.props.pinentryStates ||
      nextProps.updateConfirmState !== this.props.updateConfirmState ||
      nextProps.updatePausedState !== this.props.updatePausedState
  }

  trackerRemoteComponents () {
    const {trackers} = this.props
    return Object.keys(trackers).filter(username => !trackers[username].closed).map(username => (
      <RemoteComponent {...trackerComponentProps(username, trackers[username], this.props.trackerActions)} />
    ))
  }

  pinentryRemoteComponents () {
    const {pinentryStates} = this.props
    return Object.keys(pinentryStates).filter(sid => !pinentryStates[sid].closed).map(pSessionID => (
      <RemoteComponent {...pinentryComponentProps(pSessionID, this.props)}/>
    ))
  }

  showUpdateConfirmComponents () {
    const {updateConfirmState} = this.props
    if (updateConfirmState.closed) {
      return
    }

    return <RemoteComponent {...remoteComponentPropsUpdate(this.props)} />
  }

  showUpdatePausedComponents () {
    const {updatePausedState} = this.props
    if (updatePausedState.closed) {
      return
    }

    return <RemoteComponent {...remoteComponentPropsPaused(this.props)} />
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
  trackerServerStarted: React.PropTypes.bool,
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
  dispatch => ({
    ...bindActionCreators({
      registerIdentifyUi,
      registerPinentryListener,
      registerTrackerChangeListener,
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
    }, dispatch),
    trackerActions: trackerRemoteComponentActions(dispatch)
  })
)(RemoteManager)
