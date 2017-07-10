// @flow
import React, {Component} from 'react'
import Render from './render'
import some from 'lodash/some'
import get from 'lodash/get'
import flags from '../../util/feature-flags'
import type {Folder} from '../list'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {favoriteFolder, ignoreFolder} from '../../actions/favorite'
import {navigateUp, navigateAppend} from '../../actions/route-tree'
import {openInKBFS} from '../../actions/kbfs'
import {openTlfInChat} from '../../actions/chat'

type Props = $Shape<{
  folder: ?Folder,
  path: string,
  username: string,
  allowIgnore: boolean,
  navigateUp: () => void,
  navigateAppend: (route: any) => void,
  ignoreFolder: (path: string) => void,
  favoriteFolder: (path: string) => void,
  openInKBFS: (path: string) => void,
  openTlfInChat: (tlf: string) => void,
}>

type State = {
  visiblePopupMenu: boolean,
}

class Files extends Component<void, Props, State> {
  state: State

  _checkFolderExistence(props) {
    // TODO (AW): make a more user friendly response for when the folder they were hoping to look at
    // has been removed/defavorited in the time between them clicking it in the Folders view and the
    // loading of this component
    if (!props.folder) {
      console.warn("Folder doesn't exist:", props.folder)
      props.navigateUp()
    }
  }

  constructor(props) {
    super(props)
    this.state = {
      visiblePopupMenu: false,
    }
    setImmediate(() => {
      // FIXME: we shouldn't be navigating when a component mounts
      this._checkFolderExistence(props)
    })
  }

  componentWillReceiveProps(nextProps) {
    this._checkFolderExistence(nextProps)
  }

  render() {
    const {folder, username} = this.props
    if (!folder) return null // Protect from state where the folder to be displayed was removed
    const openCurrentFolder = () => {
      this.props.openInKBFS(this.props.path)
    }
    const openConversationFromFolder = () => {
      const tlf = this.props && this.props.folder && this.props.folder.sortName
      tlf && this.props.openTlfInChat(tlf)
    }
    const ignoreCurrentFolder = () => {
      this.props.ignoreFolder(this.props.path)
    }
    const unIgnoreCurrentFolder = () => {
      this.props.favoriteFolder(this.props.path)
    }
    const allowIgnore = folder.users.some(f => !f.you)

    return (
      <Render
        ignored={folder.ignored}
        theme={folder.isPublic ? 'public' : 'private'}
        popupMenuItems={[
          {onClick: openCurrentFolder, title: 'Open folder'},
          {onClick: ignoreCurrentFolder, title: 'Ignore'},
        ]}
        visiblePopupMenu={this.state.visiblePopupMenu}
        onTogglePopupMenu={() => this.setState({visiblePopupMenu: !this.state.visiblePopupMenu})}
        selfUsername={username}
        allowIgnore={allowIgnore}
        users={folder.users}
        hasReadOnlyUsers={folder.users && some(folder.users, 'readOnly')}
        waitingForParticipantUnlock={folder.waitingForParticipantUnlock}
        youCanUnlock={folder.youCanUnlock}
        onBack={() => this.props.navigateUp()}
        openCurrentFolder={openCurrentFolder}
        openConversationFromFolder={openConversationFromFolder}
        onClickPaperkey={device => this.props.navigateAppend([{selected: 'paperkey', name: device.name}])} // FIXME: does this name route prop get used anywhere?
        ignoreCurrentFolder={ignoreCurrentFolder}
        unIgnoreCurrentFolder={unIgnoreCurrentFolder}
        recentFilesSection={folder.recentFiles} // TODO (AW): integrate recent files once the service provides this data
        recentFilesEnabled={flags.recentFilesEnabled}
      />
    )
  }
}

const ConnectedFiles = connect(
  (state: any, {routeProps: {path}}) => {
    const folders: Array<Folder> = [].concat(
      get(state, 'favorite.folderState.private.tlfs', []),
      get(state, 'favorite.folderState.public.tlfs', []),
      get(state, 'favorite.folderState.private.ignored', []),
      get(state, 'favorite.folderState.public.ignored', [])
    )

    const folder = folders.find(f => f.path === path)

    return {
      path,
      folder,
      username: state.config && state.config.username,
    }
  },
  (dispatch: any) =>
    bindActionCreators(
      {favoriteFolder, ignoreFolder, navigateAppend, navigateUp, openInKBFS, openTlfInChat},
      dispatch
    )
)(Files)

export default ConnectedFiles
