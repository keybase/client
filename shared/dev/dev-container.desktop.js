/* @flow */
import React, {Component} from 'react'
import {Paper, AppBar} from 'material-ui'

export default class Container extends Component {
  render () {
    return (
      <Paper zDepth={5} style={{...this.props.style, margin: 20}}>
        <AppBar title={this.props.title} />
        <div style={{margin: 10}}>
          {this.props.children}
        </div>
      </Paper>
    )
  }
}

Container.propTypes = {
  title: React.PropTypes.string,
  style: React.PropTypes.object,
  children: React.PropTypes.node.isRequired
}
