'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import Render from './index.render'

export default class PaperKey extends Component {
  render () {
    return (
      <Render
        {...this.props}
      />
    )
  }
}

PaperKey.propTypes = {
  onSubmit: React.PropTypes.func.isRequired
}
