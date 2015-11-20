'use strict'

import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import Pinentry from '../pinentry'
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
    let result = {passphrase: passphrase}
    for (const feature in features) {
      result[feature] = features[feature]
    }
    ipc.send('pinentryResult', result)
  }

  onCancel () {
    ipc.send('pinentryResult', {error: 'User canceled'})
  }

  render () {
    if ('payload' in this.state) {
      return <Pinentry onSubmit={this.onSubmit} onCancel={this.onCancel} {...this.state} />
    }
    return <div/>
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
