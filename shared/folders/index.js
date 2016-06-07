// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import {bindActionCreators} from 'redux'
import {routeAppend} from '../actions/router'
import Files from './files'
import type {Props as RenderProps} from './render'

export type Props = {
  folderProps: ?RenderProps,
  routeAppend: (path: any) => void
}

type State = {
  showingPrivate: boolean
}

class Folders extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      showingPrivate: true
    }
  }

  render () {
    return (
      <Render
        {...this.props.folderProps}
        onClick={path => this.props.routeAppend(path)}
        onSwitchTab={showingPrivate => this.setState({showingPrivate})}
        showingPrivate={this.state.showingPrivate}
      />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Folders'},
      parseNextRoute: Files.parseRoute
    }
  }
}

export default connect(
  state => ({
    folderProps: state.favorite && state.favorite.folders
  }),
  dispatch => bindActionCreators({routeAppend}, dispatch)
)(Folders)
