import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {navigateUp} from '../actions/router'
import {globalStyles} from '../styles/style-guide'

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
  navigateUp: React.PropTypes.func.isRequired,
}

export default connect(state => state, dispatch => bindActionCreators({navigateUp}, dispatch))(MetaNavigatorRender)
