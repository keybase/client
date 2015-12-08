import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import {Pinentry} from '../pinentry'
import ipc from 'ipc'

class PinentryWrapper extends Component {
  constructor (props) {
    super(props)

    this.state = {}
    ipc.on('pinentryGotProps', props => {
      const payload = {payload: props}
      this.setState(payload)
      ipc.send('pinentryReady')
    })
    ipc.send('pinentryNeedProps')
  }

  sendResize () {
    // Kinda gross but can't figure out a good way to get this working
    setImmediate(() => {
      ipc.send('pinentryResize', window.pinentry.scrollHeight)
    })
  }

  componentDidMount () {
    this.sendResize()
  }

  componentDidUpdate () {
    this.sendResize()
  }

  onSubmit (passphrase, features) {
    // only send the features with respond back
    const payloadFeatures = this.state.payload && this.state.payload.features

    let toRespond = {}
    for (const f in payloadFeatures) {
      if (payloadFeatures[f].allow && !payloadFeatures[f].readonly) {
        toRespond[f] = features[f]
      }
    }

    ipc.send('pinentryResult', {passphrase, features: toRespond})
  }

  onCancel () {
    ipc.send('pinentryResult', {error: 'User canceled'})
  }

  render () {
    if ('payload' in this.state) {
      return <Pinentry
        onSubmit={(passphrase, features) => this.onSubmit(passphrase, features)}
        onCancel={() => this.onCancel()}
        features={this.state.payload.features}
        prompt={this.state.payload.prompt}
        retryLabel={this.state.payload.retryLabel}
        windowTitle={this.state.payload.windowTitle}
        cancelLabel={this.state.payload.cancelLabel}
        submitLabel={this.state.payload.submitLabel}
      />
    }
    return <div/>
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
