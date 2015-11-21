import React, {Component} from '../base-react'
import remote from 'remote'

const BrowserWindow = remote.require('browser-window')

export default class RemoteComponent extends Component {
  componentWillMount () {
    // TODO: create the external popup window
    this.remoteWindow = new BrowserWindow({
      width: 500, height: 300,
      // resizable: false,
      fullscreen: false
    })

    this.remoteWindow.hide()

    this.remoteWindow.on('needProps', event => {
      console.log('here with needProps')
      this.remoteWindow.show()
      this.remoteWindow.emit('hasProps', {...this.props})
    })

    const componentRequireName = this.props.component

    this.remoteWindow.loadUrl(`file://${__dirname}/remoteComponent.html#${componentRequireName || ''}`)
  }

  componentWillUnmount () {
    this.remoteWindow.close()
  }

  render () {
    console.log('rendering our remote window')
    return (<div/>)
  }

  shouldComponentUpdate (nextProps) {
    if (this.props !== nextProps && this.remoteWindow) {
      console.log('props have changed:', this.props, nextProps)
      this.remoteWindow.emit('hasProps', {...this.props})
    }
    // Always return false because this isn't a real component
    return false
  }
}

RemoteComponent.propTypes = {
  component: React.PropTypes.string
}
