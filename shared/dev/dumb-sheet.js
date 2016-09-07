// @flow
import React, {Component} from 'react'
import Render from './dumb-sheet.render'
import {connect} from 'react-redux'
import {navigateUp} from '../actions/router'
import {updateDebugConfig} from '../actions/dev'
import {isTesting} from '../local-debug'

class DumbSheet extends Component {
  render () {
    return <Render
      onBack={this.props.onBack}
      onDebugConfigChange={this.props.onDebugConfigChange}
      dumbIndex={this.props.dumbIndex}
      dumbFilter={this.props.dumbFilter}
      dumbFullscreen={this.props.dumbFullscreen}
      autoIncrement={isTesting}
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
