import React, {Component} from 'react'
import {connect} from 'react-redux'

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
