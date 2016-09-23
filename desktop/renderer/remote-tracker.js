// @flow

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {onClose, startTimer, stopTimer} from '../shared/actions/tracker'
import RemoteComponent from './remote-component'

import type {TypedState} from '../shared/constants/reducer'
import type {TrackerOrNonUserState} from '../shared/constants/tracker'
import type {Action} from '../shared/constants/types/flux'

type Props = {
  onClose: (username: string) => void,
  started: boolean,
  startTimer: () => void,
  stopTimer: () => Action,
  trackers: {[key: string]: TrackerOrNonUserState},
}

class RemoteTracker extends Component<void, Props, void> {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.trackers !== this.props.trackers
  }

  render () {
    const {trackers} = this.props
    const windowsOpts = {height: 470, width: 320}

    return (
      <div>
        {Object.keys(trackers).filter(username => !trackers[username].closed && trackers[username].type === 'tracker').map(username => (
          <RemoteComponent
            positionBottomRight={true}
            windowsOpts={windowsOpts}
            title={`tracker - ${username}`}
            waitForState={true}
            ignoreNewProps={true}
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

type OwnProps = {}

export default connect(
  (state: TypedState, op: OwnProps) => ({
    started: state.tracker.serverStarted,
    trackers: state.tracker.trackers,
  }),
  (dispatch: any, op: OwnProps) => ({
    startTimer: () => dispatch(startTimer()),
    stopTimer: () => dispatch(stopTimer()),
    onClose: (username: string) => { dispatch(onClose(username)) },
  })
)(RemoteTracker)
