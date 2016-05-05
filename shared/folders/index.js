import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

class Folders extends Component {
  render () {
    return <Render />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Folders'}}
  }
}

export default connect()(Folders)
