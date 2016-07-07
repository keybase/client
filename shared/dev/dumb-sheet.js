import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './dumb-sheet.render'
import {updateDebugConfig} from '../actions/dev'
import {navigateUp} from '../actions/router'

class DumbSheet extends Component {
  render () {
    return <Render
      onBack={this.props.onBack}
      onDebugConfigChange={this.props.onDebugConfigChange}
      dumbIndex={this.props.dumbIndex}
      dumbFilter={this.props.dumbFilter}
      dumbFullscreen={this.props.dumbFullscreen}
    />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'DumbSheet'},
    }
  }
}

export default connect(
  state => ({
    dumbIndex: state.dev.debugConfig.dumbIndex,
    dumbFilter: state.dev.debugConfig.dumbFilter,
    dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  }),
  dispatch => ({
    onBack: () => dispatch(navigateUp()),
    onDebugConfigChange: value => dispatch(updateDebugConfig(value)),
  }))(DumbSheet)
