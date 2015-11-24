/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
// $FlowIssue base-redux
import {connect} from '../base-redux'

import {bindActionCreators} from 'redux'
import {registerIdentifyUi} from '../actions/tracker'
import RemoteComponent from './remote-component'

export type RemoteManagerProps = {
  registerIdentifyUi: () => void,
  trackerServerStarted: boolean,
  trackerServerActive: boolean
}

type State = {
  showTrackerPopup: boolean
}

class RemoteManager extends Component {
  props: RemoteManagerProps;
  state: State;

  constructor(props) {
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
    if (this.state.showTrackerPopup) {
      return (
        <RemoteComponent
          windowsOpts={{
            width: 700,
            height: 700
          }}
          waitForState
          component='tracker'/>
      )
    }

    return (<div/>)
  }
}

RemoteManager.propTypes = {
  registerIdentifyUi: React.PropTypes.any,
  trackerServerStarted: React.PropTypes.any,
  trackerServerActive: React.PropTypes.any
}

export default connect(
  state => {
    return {
      trackerServerStarted: state.tracker.serverStarted,
      trackerServerActive: state.tracker.serverActive
    }
  },
  dispatch => { return bindActionCreators({registerIdentifyUi}, dispatch) }
)(RemoteManager)

