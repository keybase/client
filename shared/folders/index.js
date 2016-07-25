// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import {favoriteList, switchTab} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {bindActionCreators} from 'redux'
import {routeAppend} from '../actions/router'
import Files from './files'
import flags from '../util/feature-flags'
import type {Props as RenderProps} from './render'

export type Props = {
  favoriteList: () => void,
  folderProps: ?RenderProps,
  openInKBFS: (path: string) => void,
  showingPrivate: boolean,
  username: string,
  routeAppend: (path: any) => void,
  switchTab: (showingPrivate: boolean) => void,
}

class Folders extends Component<void, Props, void> {
  componentDidMount () {
    this.props.favoriteList()
  }

  render () {
    return (
      <Render
        {...this.props.folderProps}
        onClick={path => this.props.routeAppend(path)}
        onRekey={path => this.props.routeAppend(path)}
        onOpen={path => this.props.openInKBFS(path)}
        onSwitchTab={showingPrivate => this.props.switchTab(showingPrivate)}
        showingPrivate={this.props.showingPrivate}
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
    folderProps: state.favorite && state.favorite.folderState,
    showingPrivate: state.favorite && state.favorite.showingPrivate,
  }),
  dispatch => bindActionCreators({favoriteList, routeAppend, openInKBFS, switchTab}, dispatch)
)(Folders)
