/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onCloseFromHeader as trackerOnCloseFromHeader, startTimer as trackerStartTimer, stopTimer as trackerStopTimer} from '../shared/actions/tracker'
import {registerPinentryListener, onCancel as pinentryOnCancel, onSubmit as pinentryOnSubmit} from '../shared/actions/pinentry'
import {registerTrackerChangeListener} from '../shared/actions/tracker'
import {registerUpdateListener, onCancel as updateOnCancel, onSkip as updateOnSkip, onSnooze as updateOnSnooze, onUpdate as updateOnUpdate, setAlwaysUpdate} from '../shared/actions/update'
// $FlowIssue platform files
import RemoteComponent from './remote-component'
import featureFlags from '../../shared/util/feature-flags'

import type {GUIEntryFeatures} from '../shared/constants/types/flow-types'
import type {Action, Dispatch} from '../shared/constants/types/flux'

import type {TrackerState} from '../shared/reducers/tracker'
import type {PinentryState} from '../shared/reducers/pinentry'
import type {ShowUpdateState} from '../shared/reducers/update'

export type RemoteManagerProps = {
  registerPinentryListener: () => void,
  registerUpdateListener: () => void,
  pinentryOnCancel: (sessionID: number) => void,
  pinentryOnSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  trackerOnCloseFromHeader: () => void,
  trackerServerStarted: boolean,
  trackerStartTimer: (dispatch: Dispatch, getState: any) => void,
  trackerStopTimer: () => Action,
  trackers: {[key: string]: TrackerState},
  pinentryStates: {[key: string]: PinentryState},
  showUpdateState: ShowUpdateState,
  updateOnSkip: () => void,
  updateOnCancel: () => void,
  updateOnSnooze: () => void,
  updateOnUpdate: () => void,
  setAlwaysUpdate: (alwaysUpdate: bool) => void
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
    if (nextProps.trackers !== this.props.trackers) {
      return true
    }

    if (nextProps.pinentryStates !== this.props.pinentryStates) {
      return true
    }

    if (nextProps.showUpdateState !== this.props.showUpdateState) {
      return true
    }

    return false
  }

  trackerRemoteComponents () {
    const {trackers} = this.props
    const windowsOpts = (featureFlags.tracker === 'v2') ?
        {height: 539, width: 320} :
        {height: 339, width: 520}
    return Object.keys(trackers).filter(username => !trackers[username].closed).map(username => (
      <RemoteComponent
        windowsOpts={windowsOpts}
        title={`tracker - ${username}`}
        waitForState
        ignoreNewProps
        hidden={trackers[username].hidden}
        onRemoteClose={() => this.props.trackerOnCloseFromHeader(username)}
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
      return (
        <RemoteComponent
          title='Pinentry'
          windowsOpts={{width: 513, height: 260}}
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

  showUpdatePromptComponents () {
    const {showUpdateState} = this.props

    if (showUpdateState.closed) {
      return
    }

    return (
      <RemoteComponent
        title='Update'
        windowsOpts={{width: 480, height: 430}}
        waitForState
        component='update'
        onCancel={() => this.props.updateOnCancel()}
        onSkip={() => this.props.updateOnSkip()}
        onSnooze={() => this.props.updateOnSnooze()}
        onUpdate={() => this.props.updateOnUpdate()}
        onRemoteClose={() => this.props.updateOnCancel()}
        setAlwaysUpdate={alwaysUpdate => this.props.setAlwaysUpdate(alwaysUpdate)}
      />
    )
  }

  render () {
    return (
      <div style={{display: 'none'}}>
        {this.trackerRemoteComponents()}
        {this.pinentryRemoteComponents()}
        {this.showUpdatePromptComponents()}
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
  trackerOnCloseFromHeader: React.PropTypes.func,
  trackerServerStarted: React.PropTypes.bool,
  trackerStartTimer: React.PropTypes.func,
  trackerStopTimer: React.PropTypes.func,
  trackers: React.PropTypes.any,
  pinentryStates: React.PropTypes.any,
  showUpdateState: React.PropTypes.any,
  updateOnCancel: React.PropTypes.func,
  updateOnSkip: React.PropTypes.func,
  updateOnSnooze: React.PropTypes.func,
  updateOnUpdate: React.PropTypes.func,
  setAlwaysUpdate: React.PropTypes.func
}

export default connect(
  state => {
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackers: state.tracker.trackers,
      pinentryStates: state.pinentry.pinentryStates || {},
      showUpdateState: state.update
    }
  },
  dispatch => bindActionCreators({
    registerIdentifyUi,
    trackerStartTimer,
    trackerStopTimer,
    trackerOnCloseFromHeader,
    registerPinentryListener,
    registerTrackerChangeListener,
    pinentryOnCancel,
    pinentryOnSubmit,
    registerUpdateListener,
    updateOnCancel,
    updateOnSkip,
    updateOnSnooze,
    updateOnUpdate,
    setAlwaysUpdate
  }, dispatch)
)(RemoteManager)
