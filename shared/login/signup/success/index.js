/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './index.render'

class Success extends Component {
  render (): ReactElement {
    return (
      <Render/>
    )
  }
}

Success.propTypes = {
}

export default connect(
  state => ({}),
  dispatch => bindActionCreators({}, dispatch)
)(Success)
