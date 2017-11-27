// @flow
import * as Creators from '../../actions/tracker'
import * as TrackerGen from '../../actions/tracker-gen'
import React, {Component} from 'react'
import RemoteComponent from './remote-component.desktop'
import {connect, type TypedState} from '../../util/container'
import {type TrackerState, type NonUserState} from '../../constants/types/tracker'

type Props = {
  onClose: (username: string) => void,
  started: boolean,
  errorRetry: (username: string) => void,
  startTimer: () => void,
  stopTimer: () => void,
  trackers: {[key: string]: TrackerState},
  nonUserTrackers: {[key: string]: NonUserState},
}

const MAX_TRACKERS = 5

class RemoteTracker extends Component<Props> {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.trackers !== this.props.trackers
  }

  render() {
    const {trackers, nonUserTrackers} = this.props
    const windowsOpts = {height: 470, width: 320}

    const items = [
      ...Object.keys(trackers).filter(t => !trackers[t].closed).map(t => ({
        username: trackers[t].username,
        hidden: trackers[t].hidden,
      })),
      ...Object.keys(nonUserTrackers).filter(n => !nonUserTrackers[n].closed).map(n => ({
        username: nonUserTrackers[n].name,
        hidden: nonUserTrackers[n].hidden,
      })),
    ].slice(0, MAX_TRACKERS)

    return (
      <div>
        {items.map(item => (
          <RemoteComponent
            positionBottomRight={true}
            windowsOpts={windowsOpts}
            title={`tracker - ${item.username}`}
            waitForState={true}
            hidden={item.hidden}
            onRemoteClose={() => this.props.onClose(item.username)}
            component="tracker"
            username={item.username}
            startTimer={this.props.startTimer}
            errorRetry={() => this.props.errorRetry(item.username)}
            stopTimer={this.props.stopTimer}
            selectorParams={item.username}
            key={item.username}
          />
        ))}
      </div>
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  started: state.tracker.serverStarted,
  trackers: state.tracker.userTrackers,
  nonUserTrackers: state.tracker.nonUserTrackers,
})

const mapDispatchToProps = (dispatch: any) => ({
  startTimer: () => dispatch(Creators.startTimer()),
  stopTimer: () => dispatch(TrackerGen.createStopTimer()),
  errorRetry: (username: string) => dispatch(Creators.getProfile(username, true)),
  onClose: (username: string) => dispatch(Creators.onClose(username)),
})

export default connect(mapStateToProps, mapDispatchToProps)(RemoteTracker)
