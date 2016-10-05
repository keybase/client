// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'

class MetaNavigatorRender extends Component {
  render () {
    const {rootComponent, uri, getComponentAtTop} = this.props
    const {componentAtTop} = getComponentAtTop(rootComponent, uri)
    const Module = componentAtTop.component
    const element = componentAtTop.element

    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {element}
        {!element && Module && <Module {...componentAtTop.props} />}
      </div>
    )
  }
}

MetaNavigatorRender.propTypes = {
  uri: React.PropTypes.object.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  rootComponent: React.PropTypes.oneOfType([
    React.PropTypes.func,
    React.PropTypes.shape({
      parseRoute: React.PropTypes.func.isRequired,
    }),
  ]).isRequired,
}

// $FlowIssue
export default connect(
  state => ({}),
  dispatch => ({}),
)(MetaNavigatorRender)
