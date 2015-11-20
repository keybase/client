import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import NoTabRender from './index.render'

class NoTab extends Component {
  render () {
    return <NoTabRender />
  }

  static parseRoute () {
    return {}
  }
}

export default connect()(NoTab)
