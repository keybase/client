/* @flow */

import React, {Component} from '../base-react'
import {connect} from '../base-redux'

import engine from '../engine'

import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onCloseFromHeader as trackerOnCloseFromHeader, startTimer as trackerStartTimer, stopTimer as trackerStopTimer} from '../actions/tracker'
import {registerPinentryListener, onCancel as pinentryOnCancel, onSubmit as pinentryOnSubmit} from '../actions/pinentry'
import {registerTrackerChangeListener} from '../actions/tracker'
import {registerUpdateListener, onCancel as updateOnCancel, onSkip as updateOnSkip, onSnooze as updateOnSnooze, onUpdate as updateOnUpdate, setAlwaysUpdate} from '../actions/update'
// $FlowIssue platform files
import RemoteComponent from './remote-component'

import type {GUIEntryFeatures} from '../constants/types/flow-types'
import type {Action, Dispatch} from '../constants/types/flux'

import type {TrackerState} from '../reducers/tracker'
import type {PinentryState} from '../reducers/pinentry'
import type {ShowUpdateState} from '../reducers/update'

export type RemoteManagerProps = {
  registerPinentryListener: () => void,
  registerUpdateListener: () => void,
  pinentryOnCancel: (sessionID: number) => void,
  pinentryOnSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  onCloseFromHeader: () => void,
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

  constructor (props) {
    super(props)
    this.state = {
      popups: {}
    }
  }

  componentWillMount () {
    engine.listenOnConnect(() => {
      this.props.registerIdentifyUi()
      this.props.registerPinentryListener()
      this.props.registerTrackerChangeListener()
      this.props.registerUpdateListener()
    })
  }

  windowStates (trackers) {
    return Object.keys(trackers).map(user => {
      return `${user}:${trackers[user].closed ? 0 : 1}`
    }).join(',')
  }

  shouldComponentUpdate (nextProps, nextState) {
    // different window states
    if (this.windowStates(nextProps.trackers) !== this.windowStates(this.props.trackers)) {
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

  componentWillReceiveProps (nextProps) {
    let popups = {}

    Object.keys(nextProps.trackers).forEach(username => {
      if (!this.state.popups[username]) {
        popups[username] = (
          <RemoteComponent
            windowsOpts={{
              height: 332,
              width: 520,
              frame: false,
              resizable: false
            }}
            waitForState
            onRemoteClose={() => this.props.onCloseFromHeader(username)}
            component='tracker'
            username={username}
            substore='tracker'
            startTimer={this.props.trackerStartTimer}
            stopTimer={this.props.trackerStopTimer}
            key={username}
            />
        )
      } else {
        // keep existing ones
        popups[username] = this.state.popups[username]
      }
    })

    this.setState({popups})
  }

  pinentryRemoteComponents () {
    const windowOpts = {
      width: 513, height: 260 + 20 /* TEMP workaround for header mouse clicks in osx */,
      resizable: true,
      fullscreen: false,
      show: false,
      frame: false
    }

    const {pinentryStates} = this.props

    return Object.keys(pinentryStates).filter(sid => !pinentryStates[sid].closed).map(pSessionID => {
      const sid = parseInt(pSessionID, 10)
      const onCancel = () => this.props.pinentryOnCancel(sid)
      const onSubmit = this.props.pinentryOnSubmit.bind(null, sid)
      return (
        <RemoteComponent
          windowsOpts={windowOpts}
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

    const windowOpts = {
      width: 480, height: 430 + 20 /* TEMP workaround for header mouse clicks in osx */,
      resizable: true,
      fullscreen: false,
      show: false,
      frame: false
    }

    return (
      <RemoteComponent
        windowsOpts={windowOpts}
        waitForState
        component='update'
        substore='update'
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
      <div>
        {Object.keys(this.state.popups).filter(username => !this.props.trackers[username].closed).map(username => this.state.popups[username])}
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
  onCloseFromHeader: React.PropTypes.func,
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
