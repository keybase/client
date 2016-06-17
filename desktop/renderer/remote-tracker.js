// @flow

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onClose, startTimer, stopTimer, registerTrackerIncomingRpcs} from '../shared/actions/tracker'
import RemoteComponent from './remote-component'
import type {TrackerState} from '../shared/reducers/tracker'
import type {Action, Dispatch} from '../shared/constants/types/flux'

type Props = {
  registerIdentifyUi: () => void,
  registerTrackerIncomingRpcs: () => void,
  onClose: () => void,
  started: boolean,
  startTimer: (dispatch: Dispatch, getState: any) => void,
  stopTimer: () => Action,
  trackers: {[key: string]: TrackerState},
}

class RemoteTracker extends Component<void, Props, void> {
  componentWillMount () {
    this.props.registerIdentifyUi()
    this.props.registerTrackerIncomingRpcs()
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.trackers !== this.props.trackers
  }

  render () {
    const {trackers} = this.props
    const windowsOpts = {height: 470, width: 320}

    return (
      <div>
        {Object.keys(trackers).filter(username => !trackers[username].closed).map(username => (
          <RemoteComponent
            positionBottomRight
            windowsOpts={windowsOpts}
            title={`tracker - ${username}`}
            waitForState
            ignoreNewProps
            hidden={trackers[username].hidden}
            onRemoteClose={() => this.props.onClose(username)}
            component='tracker'
            username={username}
            startTimer={this.props.startTimer}
            stopTimer={this.props.stopTimer}
            selectorParams={username}
            key={username} />
        ))}
      </div>
    )
  }
}

export default connect(
  state => ({
    started: state.tracker.serverStarted,
    trackers: state.tracker.trackers,
  }),
  dispatch => bindActionCreators({
    registerIdentifyUi,
    startTimer,
    stopTimer,
    onClose,
    registerTrackerIncomingRpcs,
  }, dispatch)
)(RemoteTracker)
