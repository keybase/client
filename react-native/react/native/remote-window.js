import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import remote from 'remote'

const ipc = remote.require('ipc')
const BrowserWindow = remote.require('browser-window')
const currentWindow = remote.getCurrentWindow()

class RemoteWindow extends Component {
  componentWillMount () {
    // TODO: create the external popup window
    const remoteWindow = new BrowserWindow({
      width: 500, height: 300,
      // resizable: false,
      fullscreen: false
    })

    remoteWindow.hide()

    // const foo = window.open(`file://${__dirname}/remoteComponent.html#${this.props.component || ''}`)

    remoteWindow.on('needProps', (event) => {
      console.log('here with needProps')
      remoteWindow.show()
      remoteWindow.emit('hasProps', {...this.props})
    })

    remoteWindow.loadUrl(`file://${__dirname}/remoteComponent.html#${this.props.component || ''}`)

    // TODO remove all Listeners once at the beginning
    ipc.removeAllListeners('dispatchAction')
    // TODO we only need this added once
    ipc.on('dispatchAction', (event, action) => {
      console.log('I want to dispatch', action)
      this.props.dispatch(action)
    })

    // TODO: listen for actions coming from the popup window
  }

  componentWillReceiveProps () {
    // TODO: change the props of the remote window
    // TODO: change the active component the remote window has rendered
  }

  componentWillUnmount () {
    // TODO: Close the external popup window
  }

  render () {
    console.log('rendering our remote window')
    return (<div/>)
  }

  shouldComponentUpdate () {
    // Always return false because this isn't a real component
    return false
  }
}

RemoteWindow.propTypes = {
  component: React.PropTypes.string.isRequired
}

export default connect(
  () => { return {} },
  dispatch => { return {dispatch} }
)(RemoteWindow)
