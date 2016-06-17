import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import {BackButton} from '../common-adapters'
import {navigateUp} from '../actions/router'
import {globalStyles} from '../styles/style-guide'

class MetaNavigatorRender extends Component {
  onBack () {
    this.props.navigateUp()
  }

  render () {
    const {rootComponent, uri, getComponentAtTop} = this.props
    const {componentAtTop} = getComponentAtTop(rootComponent, uri)
    const Module = componentAtTop.component
    const element = componentAtTop.element
    const hideBack = !!componentAtTop.hideBack

    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {element}
        {!element && Module && <Module {...componentAtTop.props} />}
        {!hideBack && uri && uri.count() > 1 && <BackButton title='Debug Back' onClick={() => this.onBack()} style={styles.backButton} />}
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

const styles = {
  backButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    opacity: 0.8,
    zIndex: 9999,
  },
}

export default connect(state => state, dispatch => bindActionCreators({navigateUp}, dispatch))(MetaNavigatorRender)
