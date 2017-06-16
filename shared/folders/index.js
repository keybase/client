// @flow
import React, {Component} from 'react'
import Render from './render'
import {connect} from 'react-redux'
import {favoriteList} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {openTlfInChat} from '../actions/chat'

import {switchTo, navigateAppend} from '../actions/route-tree'

import type {RouteProps} from '../route-tree/render-route'
import type {TypedState} from '../constants/reducer'
import type {FolderState} from '../constants/favorite'

export type Props = {
  favoriteList: () => void,
  folderState: ?FolderState,
  openInKBFS: (path: string) => void,
  openTlfInChat: (tlf: string) => void,
  showingPrivate: boolean,
  username: ?string,
  onOpenFolder: (path: any) => void,
  onRekeyFolder: (path: any) => void,
  switchTab: (showingPrivate: boolean) => void,
  onToggleShowIgnored: () => void,
  showingIgnored: boolean,
}

class Folders extends Component<void, Props, void> {
  componentDidMount() {
    console.warn('folders mount')
    this.props.favoriteList()
  }

  render() {
    return (
      <Render
        {...this.props.folderState}
        onClick={path => this.props.onOpenFolder(path)}
        onRekey={path => this.props.onRekeyFolder(path)}
        onOpen={path => this.props.openInKBFS(path)}
        onChat={tlf => this.props.openTlfInChat(tlf)}
        onSwitchTab={showingPrivate => this.props.switchTab(showingPrivate)}
        showingPrivate={this.props.showingPrivate}
        username={this.props.username}
        onToggleShowIgnored={this.props.onToggleShowIgnored}
        showingIgnored={this.props.showingIgnored}
      />
    )
  }
}

type FoldersRouteProps = RouteProps<{}, {showingIgnored: boolean}>
type OwnProps = FoldersRouteProps & {showingPrivate: boolean}

const ConnectedFolders = connect(
  (state: TypedState, {routeState, showingPrivate}: OwnProps) => ({
    username: state.config.username,
    folderState: state.favorite ? state.favorite.folderState : null,
    showingPrivate: !!state.favorite && showingPrivate,
    showingIgnored: !!state.favorite && routeState.showingIgnored,
  }),
  (dispatch: any, {routePath, routeState, setRouteState}: OwnProps) => ({
    favoriteList: () => {
      dispatch(favoriteList())
    },
    onOpenFolder: path => {
      dispatch(navigateAppend([{selected: 'files', props: {path}}]))
    },
    onRekeyFolder: path => {
      dispatch(navigateAppend([{selected: 'files', props: {path}}]))
    },
    openInKBFS: path => {
      dispatch(openInKBFS(path))
    },
    openTlfInChat: tlf => {
      dispatch(openTlfInChat(tlf))
    },
    switchTab: showingPrivate => {
      dispatch(switchTo(routePath.pop().push(showingPrivate ? 'private' : 'public')))
    },
    onToggleShowIgnored: () => {
      setRouteState({showingIgnored: !routeState.showingIgnored})
    },
  })
)(Folders)

export function PrivateFolders(props: FoldersRouteProps) {
  return <ConnectedFolders showingPrivate={true} {...props} />
}

export function PublicFolders(props: FoldersRouteProps) {
  return <ConnectedFolders showingPrivate={false} {...props} />
}
