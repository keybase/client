import React, {Component} from 'react'
import {connect} from 'react-redux'
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
