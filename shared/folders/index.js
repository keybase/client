// @flow
import Files from './files'
import React, {Component} from 'react'
import Render from './render'
import flags from '../util/feature-flags'
import {connect} from 'react-redux'
import {favoriteList, switchTab, toggleShowIgnored as onToggleShowIgnored} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend} from '../actions/router'

import type {TypedState} from '../constants/reducer'
import type {FolderState} from '../constants/favorite'

export type Props = {
  favoriteList: () => void,
  folderState: ?FolderState,
  openInKBFS: (path: string) => void,
  showingPrivate: boolean,
  username: ?string,
  routeAppend: (path: any) => void,
  switchTab: (showingPrivate: boolean) => void,
  onToggleShowIgnored: (isPrivate: boolean) => void,
  publicShowingIgnored: boolean,
  privateShowingIgnored: boolean,
}

class Folders extends Component<void, Props, void> {
  componentDidMount () {
    this.props.favoriteList()
  }

  render () {
    return (
      <Render
        {...this.props.folderState}
        onClick={path => this.props.routeAppend(path)}
        onRekey={path => this.props.routeAppend(path)}
        onOpen={path => this.props.openInKBFS(path)}
        onSwitchTab={showingPrivate => this.props.switchTab(showingPrivate)}
        showingPrivate={this.props.showingPrivate}
        showComingSoon={!flags.tabFoldersEnabled}
        username={this.props.username}
        onToggleShowIgnored={this.props.onToggleShowIgnored}
        publicShowingIgnored={this.props.publicShowingIgnored}
        privateShowingIgnored={this.props.privateShowingIgnored}
      />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Folders'},
      // $FlowIssue
      parseNextRoute: Files.parseRoute,
    }
  }
}

export default connect(
  (state: TypedState) => ({
    username: state.config.username,
    folderState: state.favorite ? state.favorite.folderState : null,
    showingPrivate: !!state.favorite && state.favorite.viewState.showingPrivate,
    publicShowingIgnored: !!state.favorite && state.favorite.viewState.publicIgnoredOpen,
    privateShowingIgnored: !!state.favorite && state.favorite.viewState.privateIgnoredOpen,
  }),
  (dispatch: any) => ({
    favoriteList: () => { dispatch(favoriteList()) },
    routeAppend: path => { dispatch(routeAppend(path)) },
    openInKBFS: path => { dispatch(openInKBFS(path)) },
    switchTab: showingPrivate => { dispatch(switchTab(showingPrivate)) },
    onToggleShowIgnored: isPrivate => { dispatch(onToggleShowIgnored(isPrivate)) },
  })
)(Folders)
