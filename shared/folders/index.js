// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import {openInKBFS} from '../actions/kbfs'
import {bindActionCreators} from 'redux'
import {routeAppend} from '../actions/router'
import Files from './files'
import flags from '../util/feature-flags'
import type {Props as RenderProps} from './render'

export type Props = {
  folderProps: ?RenderProps,
  openInKBFS: (path: string) => void,
  username: string,
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
      showingPrivate: true,
    }
  }

  render () {
    return (
      <Render
        {...this.props.folderProps}
        onClick={path => this.props.routeAppend(path)}
        onOpen={path => this.props.openInKBFS(path)}
        onSwitchTab={showingPrivate => this.setState({showingPrivate})}
        showingPrivate={this.state.showingPrivate}
        showComingSoon={!flags.tabFoldersEnabled}
        username={this.props.username}
      />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Folders'},
      parseNextRoute: Files.parseRoute,
    }
  }
}

export default connect(
  state => ({
    username: state.config.username,
    folderProps: state.favorite && state.favorite.folders,
  }),
  dispatch => bindActionCreators({routeAppend, openInKBFS}, dispatch)
)(Folders)
