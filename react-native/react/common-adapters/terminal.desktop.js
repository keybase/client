import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'

export default class Terminal extends Component {
  render () {
    return (
      <div style={{...styles.container, ...this.props.style}}>
        {this.props.children}
      </div>
    )
  }
}

Terminal.propTypes = {
  style: React.PropTypes.object
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    color: globalColors.white,
    backgroundColor: globalColors.grey1,
    padding: 10,
    justifyContent: 'stretch',
    alignItems: 'flex-start'
  }
}

Terminal.propTypes = {
  children: React.PropTypes.node
}
