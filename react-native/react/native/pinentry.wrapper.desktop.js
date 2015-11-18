import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import Pinentry from '../pinentry'
import ipc from 'ipc'

class PinentryWrapper extends Component {
  componentWillMount () {
    ipc.send('sendProps')
    ipc.on('sendingProps', function (props) {
      console.log('received sendingProps')
      this.props = props
      console.log(this.props)
    })
  }
  render () {
    if (this.props.features) {
      return <Pinentry />
    }
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
