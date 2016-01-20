import React, {Component} from '../base-react'
import {connect} from '../base-redux'
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
