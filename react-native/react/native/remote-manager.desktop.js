/* @flow */

import React, {Component} from '../base-react'
import {connect} from '../base-redux'

import {bindActionCreators} from 'redux'
import {registerIdentifyUi, onCloseFromHeader} from '../actions/tracker'
// $FlowIssue platform files
import RemoteComponent from './remote-component'

export type RemoteManagerProps = {
  registerIdentifyUi: () => void,
  onCloseFromHeader: () => void,
  trackerServerStarted: boolean,
  trackerServerActive: boolean
}

class RemoteManager extends Component {
  props: RemoteManagerProps;

  constructor (props) {
    super(props)
    this.state = {
      showTrackerPopup: false
    }
  }

  componentWillMount () {
    if (!this.props.trackerServerStarted) {
      console.log('starting identify ui server')
      this.props.registerIdentifyUi()
    }
  }

  componentWillReceiveProps (nextProps) {
    if (!this.props.trackerServerActive && nextProps.trackerServerActive) {
      this.setState({showTrackerPopup: true})
    }
  }

  render () {
    if (!this.props.trackerClosed) {
      return (
        <RemoteComponent
          windowsOpts={{
            height: 332,
            width: 520,
            frame: false,
            resizable: false
          }}
          waitForState
          onRemoteClose={this.props.onCloseFromHeader}
          component='tracker'/>
      )
    }

    return (<div/>)
  }
}

RemoteManager.propTypes = {
  registerIdentifyUi: React.PropTypes.any,
  onCloseFromHeader: React.PropTypes.any,
  trackerServerStarted: React.PropTypes.bool,
  trackerServerActive: React.PropTypes.bool,
  trackerClosed: React.PropTypes.bool
}

export default connect(
  state => {
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackerServerActive: state.tracker.serverActive,
      trackerClosed: state.tracker.closed
    }
  },
  dispatch => { return bindActionCreators({registerIdentifyUi, onCloseFromHeader}, dispatch) }
)(RemoteManager)

