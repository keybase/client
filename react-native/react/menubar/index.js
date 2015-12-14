/* @flow */

import React, {Component} from '../base-react'
import Render from './index.render'
import {connect} from '../base-redux'

export type MenubarProps = {
  debug?: boolean
}

class Menubar extends Component {
  props: MenubarProps;
  render () {
    return <Render {...this.props}/>
  }
}

export default connect(
  state => state
)(Menubar)
