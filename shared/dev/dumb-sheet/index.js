// @flow
import React from 'react'
import Render from './render'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'
import {updateDebugConfig} from '../../actions/dev'
import {isTesting} from '../../local-debug'

function DumbSheet(props) {
  return (
    <Render
      onBack={props.onBack}
      onDebugConfigChange={props.onDebugConfigChange}
      dumbIndex={props.dumbIndex}
      dumbFilter={props.dumbFilter}
      dumbFullscreen={props.dumbFullscreen}
      autoIncrement={isTesting}
    />
  )
}

export default connect(
  (state: any) => ({
    dumbIndex: state.dev.debugConfig.dumbIndex,
    dumbFilter: state.dev.debugConfig.dumbFilter,
    dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  }),
  (dispatch: any) => ({
    onBack: () => dispatch(navigateUp()),
    onDebugConfigChange: value => dispatch(updateDebugConfig(value)),
  })
)(DumbSheet)
