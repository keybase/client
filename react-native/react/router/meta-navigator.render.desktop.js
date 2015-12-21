import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import {navigateUp} from '../actions/router'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

class MetaNavigatorRender extends Component {
  onBack () {
    this.props.navigateUp()
  }

  render () {
    const {rootComponent, uri, getComponentAtTop} = this.props
    const {componentAtTop} = getComponentAtTop(rootComponent, uri)
    const Module = componentAtTop.component

    return (
      <div>
        <Module {...componentAtTop.props} />
        {uri && uri.count() > 1 && <FlatButton onClick={ () => this.onBack() } style={styles.backButton} label='Back'/>}
      </div>
    )
  }
}

MetaNavigatorRender.propTypes = {
  uri: React.PropTypes.object.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  rootComponent: React.PropTypes.func.isRequired,
  navigateUp: React.PropTypes.func.isRequired
}

const styles = {
  backButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#cccccc'
  }
}

export default connect(state => state, dispatch => bindActionCreators({navigateUp}, dispatch))(MetaNavigatorRender)
