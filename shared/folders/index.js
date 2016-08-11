// @flow
import Files from './files'
import React, {Component} from 'react'
import Render from './render'
import flags from '../util/feature-flags'
import type {Props as RenderProps} from './render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {favoriteList, switchTab, toggleShowIgnored as onToggleShowIgnored} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend} from '../actions/router'

export type Props = {
  favoriteList: () => void,
  folderProps: ?RenderProps,
  openInKBFS: (path: string) => void,
  showingPrivate: boolean,
  username: string,
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
        {...this.props.folderProps}
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
      parseNextRoute: Files.parseRoute,
    }
  }
}

export default connect(
  state => ({
    username: state.config.username,
    folderProps: state.favorite && state.favorite.folderState,
    showingPrivate: state.favorite && state.favorite.viewState.showingPrivate,
    publicShowingIgnored: state.favorite && state.favorite.viewState.publicIgnoredOpen,
    privateShowingIgnored: state.favorite && state.favorite.viewState.privateIgnoredOpen,
  }),
  dispatch => bindActionCreators({favoriteList, routeAppend, openInKBFS, switchTab, onToggleShowIgnored}, dispatch)
)(Folders)
