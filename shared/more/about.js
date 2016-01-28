import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import Render from './about.render'

class About extends Component {
  // TODO get version from golang
  render () {
    return <Render />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'About'}}
  }
}

About.propTypes = {}

export default connect()(About)
