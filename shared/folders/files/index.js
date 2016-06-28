// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {openInKBFS} from '../../actions/kbfs'
import {favoriteFolder, ignoreFolder} from '../../actions/favorite'
import {navigateBack} from '../../actions/router'
import flags from '../../util/feature-flags'
import Render from './render'
import _ from 'lodash'

import type {Folder} from '../list'

type Props = $Shape<{
  folder: ?Folder,
  path: string,
  username: string,
  navigateBack: () => void,
  ignoreFolder: (path: string) => void,
  favoriteFolder: (path: string) => void,
  openInKBFS: (path: string) => void
}>

type State = {
  visiblePopupMenu: boolean
};

class Files extends Component<void, Props, State> {
  state: State;

  _checkFolderExistence (props) {
    // TODO (AW): make a more user friendly response for when the folder they were hoping to look at
    // has been removed/defavorited in the time between them clicking it in the Folders view and the
    // loading of this component
    if (!props.folder) props.navigateBack()
  }

  constructor (props) {
    super(props)
    this.state = {
      visiblePopupMenu: false,
    }
    this._checkFolderExistence(props)
  }

  componentWillReceiveProps (nextProps) {
    this._checkFolderExistence(nextProps)
  }

  render () {
    const {folder, username} = this.props
    if (!folder) return null // Protect from state where the folder to be displayed was removed
    const openCurrentFolder = () => { this.props.openInKBFS(this.props.path) }
    const ignoreCurrentFolder = () => { this.props.ignoreFolder(this.props.path) }
    const unIgnoreCurrentFolder = () => { this.props.favoriteFolder(this.props.path) }
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
        users={folder.users}
        waitingForParticipantUnlock={folder.waitingForParticipantUnlock}
        youCanUnlock={folder.youCanUnlock}
        onBack={() => this.props.navigateBack()}
        openCurrentFolder={openCurrentFolder}
        ignoreCurrentFolder={ignoreCurrentFolder}
        unIgnoreCurrentFolder={unIgnoreCurrentFolder}
        recentFilesSection={folder.recentFiles} // TODO (AW): integrate recent files once the service provides this data
        recentFilesEnabled={flags.recentFilesEnabled}
      />
    )
  }

  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Files',
        element: <ConnectedFiles path={currentPath.get('path')} />,
      },
    }
  }
}

const ConnectedFiles = connect(
  (state, ownProps) => {
    const folders: Array<Folder> = [].concat(
      _.get(state, 'favorite.private.tlfs', []),
      _.get(state, 'favorite.public.tlfs', []),
      _.get(state, 'favorite.private.ignored', []),
      _.get(state, 'favorite.public.ignored', [])
    )
    const folder = folders.find(f => f.path === ownProps.path)
    return {
      folder,
      username: state.config && state.config.username,
    }
  },
  dispatch => bindActionCreators({favoriteFolder, ignoreFolder, navigateBack, openInKBFS}, dispatch)
)(Files)

export default ConnectedFiles
