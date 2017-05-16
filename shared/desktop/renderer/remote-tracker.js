// @flow
import React, {Component} from 'react'
import RemoteComponent from './remote-component'
import {connect} from 'react-redux'
import {onClose, startTimer, stopTimer, getProfile} from '../../actions/tracker'

import type {TypedState} from '../../constants/reducer'
import type {TrackerOrNonUserState} from '../../constants/tracker'
import type {Action} from '../../constants/types/flux'

type Props = {
  onClose: (username: string) => void,
  started: boolean,
  errorRetry: (username: string) => void,
  startTimer: () => void,
  stopTimer: () => Action,
  trackers: {[key: string]: TrackerOrNonUserState},
}

class RemoteTracker extends Component<void, Props, void> {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.trackers !== this.props.trackers
  }

  render() {
    const {trackers} = this.props
    const windowsOpts = {height: 470, width: 320}

    return (
      <div>
        {Object.keys(trackers)
          .filter(username => !trackers[username].closed)
          .map(username => (
            <RemoteComponent
              positionBottomRight={true}
              windowsOpts={windowsOpts}
              title={`tracker - ${username}`}
              waitForState={true}
              ignoreNewProps={true}
              hidden={trackers[username].hidden}
              onRemoteClose={() => this.props.onClose(username)}
              component="tracker"
              username={username}
              startTimer={this.props.startTimer}
              errorRetry={() => this.props.errorRetry(username)}
              stopTimer={this.props.stopTimer}
              selectorParams={username}
              key={username}
            />
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
    errorRetry: (username: string) => {
      dispatch(getProfile(username, true))
    },
    onClose: (username: string) => {
      dispatch(onClose(username))
    },
  })
)(RemoteTracker)
