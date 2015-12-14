/* @flow */

import React, {Component} from '../base-react'
import Render from './index.render'
import {connect} from '../base-redux'

class Menubar extends Component {
  render () {
    return <Render {...this.props}/>
  }
}

export default connect(
  state => state
)(Menubar)
