import React, {Component} from '../base-react'
import remote from 'remote'

const BrowserWindow = remote.require('browser-window')

export default class RemoteComponent extends Component {
  componentWillMount () {
    const windowsOpts = {width: 500, height: 300, fullscreen: false, ...this.props.windowsOpts,}
    this.remoteWindow = new BrowserWindow(windowsOpts)
    this.closed = false

    this.remoteWindow.hide()

    this.remoteWindow.on('needProps', () => {
      this.remoteWindow.emit('hasProps', {...this.props})
    })

    // Remember if we close, it's an error to try to close an already closed window
    this.remoteWindow.on('close', () => {
      this.closed = true
    })

    const componentRequireName = this.props.component

    this.remoteWindow.loadUrl(`file://${__dirname}/remoteComponent.html#${componentRequireName || ''}`)
  }

  componentWillUnmount () {
    if (!this.closed) {
      this.remoteWindow.close()
      this.closed = true
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
  component: React.PropTypes.string,
  windowsOpts: React.PropTypes.object
}
