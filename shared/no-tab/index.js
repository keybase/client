// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'

// $FlowIssue
import NoTabRender from './index.render'

class NoTab extends Component {
  render () {
    return <NoTabRender />
  }
}

export default connect()(NoTab)
