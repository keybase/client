/* @flow */

import React, {Component} from '../base-react'
import {connect} from '../base-redux'

import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onCloseFromHeader} from '../actions/tracker'
import {registerPinentryListener, onCancel as pinentyOnCancel} from '../actions/pinentry'
// $FlowIssue platform files
import RemoteComponent from './remote-component'

import type {TrackerState} from '../reducers/tracker'
import type {PinentryState} from '../reducers/pinentry'

export type RemoteManagerProps = {
  registerPinentryListener: () => void,
  pinentyOnCancel: () => void,
  registerIdentifyUi: () => void,
  onCloseFromHeader: () => void,
  trackerServerStarted: boolean,
  trackers: {[key: string]: TrackerState},
  pinentryStates: {[key: string]: PinentryState}
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
    if (!this.props.trackerServerStarted) {
      console.log('starting identify ui server')
      this.props.registerIdentifyUi()
      this.props.registerPinentryListener()
    }
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
      width: 513, height: 230 + 20 /* TEMP workaround for header mouse clicks in osx */,
      resizable: true,
      fullscreen: false,
      show: false,
      frame: false
    }

    const {pinentryStates} = this.props

    return Object.keys(pinentryStates).filter(sid => !pinentryStates[sid].closed).map(pSessionID => {
      return (
        <RemoteComponent
          windowsOpts={windowOpts}
          waitForState
          onRemoteClose={() => this.props.pinentyOnCancel(pSessionID)}
          component='pinentry'
          sessionID={parseInt(pSessionID)}
          key={'pinentry:'+pSessionID} />
      )
    })
  }

  render () {
    return (
      <div>
        {Object.keys(this.state.popups).filter(username => !this.props.trackers[username].closed).map(username => this.state.popups[username])}
        {this.pinentryRemoteComponents()}
      </div>
    )
  }
}

RemoteManager.propTypes = {
  pinentyOnCancel: React.PropTypes.any,
  registerPinentryListener: React.PropTypes.any,
  registerIdentifyUi: React.PropTypes.any,
  onCloseFromHeader: React.PropTypes.any,
  trackerServerStarted: React.PropTypes.bool,
  trackers: React.PropTypes.any,
  pinentryStates: React.PropTypes.any
}

export default connect(
  state => {
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackers: state.tracker.trackers,
      pinentryStates: state.pinentry.pinentryStates || {}
    }
  },
  dispatch => bindActionCreators({registerIdentifyUi, onCloseFromHeader, registerPinentryListener, pinentyOnCancel}, dispatch)
)(RemoteManager)

