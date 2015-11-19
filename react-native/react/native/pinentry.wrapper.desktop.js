'use strict'

import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import Pinentry from '../pinentry'
import ipc from 'ipc'

class PinentryWrapper extends Component {
  constructor (props) {
    super(props)

    this.state = {}
    ipc.on('gotProps', (props) => {
      console.log('received gotProps')
      const payload = {
        payload: props
      }
      this.setState(payload)
      console.log('foo')
      ipc.send('pinentryReady')
    })
    console.log('sending needProps')
    ipc.send('needProps')
  }

  onSubmit (passphrase, features) {
    console.log('in onSubmit')
    let result = {
      passphrase: passphrase
    }
    for (const feature in features) {
      result[feature] = features[feature]
    }
    console.log(result)
    ipc.send('pinentryResult', result)
  }

  onCancel () {
    console.log('in onClear')
  }

  render () {
    if ('payload' in this.state) {
      return <Pinentry onSubmit={this.onSubmit} onCancel={this.onCancel} {...this.state} />
    }
    return <div/>
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
