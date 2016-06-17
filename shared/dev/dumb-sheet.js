import React, {Component} from 'react'
import Render from './dumb-sheet.render'

class DumbSheet extends Component {
  render () {
    return <Render />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'DumbSheet'},
    }
  }
}

export default DumbSheet
