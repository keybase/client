import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import Pinentry from '../pinentry'
import ipc from 'ipc'

class PinentryWrapper extends Component {
  constructor (props) {
    super(props)

    this.state = {}
    ipc.on('sendingProps', (props) => {
      const payload = {
        payload: props
      }
      this.setState(payload)
    })
    ipc.send('sendProps')
  }

  render () {
    if ('payload' in this.state) {
      return <Pinentry {...this.state}/>
    }
    return <div/>
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
