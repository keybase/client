import React, {Component} from 'react'
import {connect} from 'react-redux'
import FoldersRender from './index.render'

class Folders extends Component {
  render () {
    return <FoldersRender />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Folders'}}
  }
}

export default connect()(Folders)
