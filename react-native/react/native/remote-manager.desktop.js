/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
// $FlowIssue base-redux
import {connect} from '../base-redux'

import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onCloseFromHeader} from '../actions/tracker'
// $FlowIssue platform files
import RemoteComponent from './remote-component'

export type RemoteManagerProps = {
  registerIdentifyUi: () => void,
  onCloseFromHeader: () => void,
  trackerServerStarted: boolean,
  trackers: any
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
    }
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (Object.keys(nextProps.trackers).join(',') !== Object.keys(this.props.trackers).join(',')) {
      return true
    }

    return true
  }

  componentWillReceiveProps (nextProps) {
    // No new trackers
    if (Object.keys(nextProps.trackers).join(',') === Object.keys(this.props.trackers).join(',')) {
      return
    }

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
            onRemoteClose={this.props.onCloseFromHeader}
            component='tracker'
            username={username}
            substore='tracker'
            />
        )
      } else {
        // keep existing ones
        popups[username] = this.state.popups[username]
      }
    })

    this.setState({popups})
  }

  render () {
    return (
      <div>
      {Object.keys(this.state.popups).map(username => this.state.popups[username])}
      </div>
    )
  }
}

RemoteManager.propTypes = {
  registerIdentifyUi: React.PropTypes.any,
  onCloseFromHeader: React.PropTypes.any,
  trackerServerStarted: React.PropTypes.bool,
  trackers: React.PropTypes.any
}

export default connect(
  state => {
    console.log('NOJ', state.tracker.trackers)
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackers: state.tracker.trackers
    }
  },
  dispatch => { return bindActionCreators({registerIdentifyUi, onCloseFromHeader}, dispatch) }
)(RemoteManager)

