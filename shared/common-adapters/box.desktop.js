// @flow
import * as React from 'react'
import {globalStyles} from '../styles'

class Box extends React.Component<any> {
  render() {
    return <div {...this.props} />
  }
}

type VBoxProps = {
  children: React.Node,
  fullHeight?: true,
}
class VBox extends React.Component<VBoxProps> {
  render() {
    return (
      <div style={this.props.fullHeight ? styles.vboxFullHeight : styles.vbox}>{this.props.children}</div>
    )
  }
}

type HBoxProps = {
  children: React.Node,
  fullWidth?: true,
}
class HBox extends React.Component<HBoxProps> {
  render() {
    return <div style={this.props.fullWidth ? styles.hboxFullWidth : styles.hbox}>{this.props.children}</div>
  }
}

const styles = {
  hbox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    height: '100%',
  },
  hboxFullWidth: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    height: '100%',
    width: '100%',
  },
  vbox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    width: '100%',
  },
  vboxFullHeight: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    height: '100%',
    width: '100%',
  },
}

export default Box
export {Box, VBox, HBox}
