import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './dumb-sheet.render'
import {navigateUp} from '../actions/router'

class DumbSheet extends Component {
  render () {
    return <Render onBack={this.props.onBack} />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'DumbSheet'},
    }
  }
}

export default connect(
  state => ({}),
  dispatch => ({
    onBack: () => dispatch(navigateUp()),
  }))(DumbSheet)
