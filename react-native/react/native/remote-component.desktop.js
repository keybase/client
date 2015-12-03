import React, {Component} from '../base-react'
import remote from 'remote'
import {showDevTools} from '../local-debug'

const BrowserWindow = remote.require('browser-window')

export default class RemoteComponent extends Component {
  componentWillMount () {
    const windowsOpts = {width: 500, height: 300, fullscreen: false, show: false, ...this.props.windowsOpts}
    this.remoteWindow = new BrowserWindow(windowsOpts)
    this.closed = false

    if (showDevTools) {
      this.remoteWindow.toggleDevTools()
    }

    this.remoteWindow.on('needProps', () => {
      this.remoteWindow.emit('hasProps', {...this.props})
    })

    // Remember if we close, it's an error to try to close an already closed window
    this.remoteWindow.on('close', () => {
      if (!this.closed) {
        this.closed = true
        this.props.onRemoteClose && this.props.onRemoteClose()
      }
    })

    const componentRequireName = this.props.component
    const substore = this.props.substore

    this.remoteWindow.loadUrl(`file://${__dirname}/remoteComponent.html#${componentRequireName || ''}:${substore || ''}`)
  }

  componentWillUnmount () {
    if (!this.closed) {
      this.closed = true
      this.remoteWindow.close()
    }
  }

  render () {
    return (<div/>)
  }

  shouldComponentUpdate (nextProps) {
    if (this.props !== nextProps && this.remoteWindow) {
      this.remoteWindow.emit('hasProps', {...this.props})
    }
    // Always return false because this isn't a real component
    return false
  }
}

RemoteComponent.propTypes = {
  component: React.PropTypes.string.isRequired,
  substore: React.PropTypes.string,
  windowsOpts: React.PropTypes.object,
  onRemoteClose: React.PropTypes.func
}
