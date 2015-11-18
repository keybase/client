import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'

import Pinentry from '../pinentry'

class PinentryWrapper extends Component {
  render () {
    return <Pinentry />
  }
}

ReactDOM.render(<PinentryWrapper/>, document.getElementById('pinentry'))
