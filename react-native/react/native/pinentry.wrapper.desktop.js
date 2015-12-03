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

  onSubmit (passphrase, features) {
    // only send the features with respond back
    const payloadFeatures = this.state.payload && this.state.payload.features

    let toRespond = {}
    for (const f in payloadFeatures) {
      if (payloadFeatures[f].respond) {
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
      />
    }
    return <div/>
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
