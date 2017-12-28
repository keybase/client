// @flow
import * as ChatGen from '../../actions/chat-gen'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as FavoriteGen from '../../actions/favorite-gen'
import React, {Component} from 'react'
import Render from './render'
import get from 'lodash/get'
import some from 'lodash/some'
import type {Folder} from '../list'
import {connect} from 'react-redux'
import {navigateUp, navigateAppend} from '../../actions/route-tree'

type Props = $Shape<{
  folder: ?Folder,
  path: string,
  username: string,
  allowIgnore: boolean,
  isTeam: boolean,
  navigateUp: () => void,
  navigateAppend: (route: any) => void,
  ignoreFolder: (path: string) => void,
  favoriteFolder: (path: string) => void,
  openInKBFS: (path: string) => void,
  openTlfInChat: (tlf: string, isTeam: boolean) => void,
}>

type State = {
  visiblePopupMenu: boolean,
}

class Files extends Component<Props, State> {
  state: State

  _checkFolderExistence(props) {
    // TODO (AW): make a more user friendly response for when the folder they were hoping to look at
    // has been removed/defavorited in the time between them clicking it in the Folders view and the
    // loading of this component
    if (!props.folder) props.navigateUp()
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

  componentDidMount() {
    if (this.props.folder && !this.props.folder.ignored && this.props.folder.meta === 'new') {
      this.props.favoriteFolder(this.props.path)
    }
  }

  render() {
    const {folder, username} = this.props
    if (!folder) return null // Protect from state where the folder to be displayed was removed
    const openCurrentFolder = () => {
      this.props.openInKBFS(this.props.path)
    }
    const openConversationFromFolder = () => {
      const tlf = this.props && this.props.folder && this.props.folder.sortName
      tlf && this.props.openTlfInChat(tlf, this.props.folder ? this.props.folder.isTeam : false)
    }
    const ignoreCurrentFolder = () => {
      this.props.ignoreFolder(this.props.path)
      this.props.navigateUp()
    }
    const unIgnoreCurrentFolder = () => {
      this.props.favoriteFolder(this.props.path)
      this.props.navigateUp()
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
        onTogglePopupMenu={() =>
          this.setState(prevState => ({visiblePopupMenu: !prevState.visiblePopupMenu}))
        }
        selfUsername={username}
        allowIgnore={allowIgnore}
        users={folder.users}
        hasReadOnlyUsers={folder.users && some(folder.users, 'readOnly')}
        waitingForParticipantUnlock={folder.waitingForParticipantUnlock}
        youCanUnlock={folder.youCanUnlock}
        isTeam={folder.isTeam}
        onBack={() => this.props.navigateUp()}
        openCurrentFolder={openCurrentFolder}
        openConversationFromFolder={openConversationFromFolder}
        onClickPaperkey={device => this.props.navigateAppend([{selected: 'paperkey', name: device.name}])} // FIXME: does this name route prop get used anywhere?
        ignoreCurrentFolder={ignoreCurrentFolder}
        unIgnoreCurrentFolder={unIgnoreCurrentFolder}
      />
    )
  }
}

const mapStateToProps = (state: any, {routeProps}) => {
  const folders: Array<Folder> = [].concat(
    get(state, 'favorite.folderState.private.tlfs', []),
    get(state, 'favorite.folderState.public.tlfs', []),
    get(state, 'favorite.folderState.team.tlfs', []),
    get(state, 'favorite.folderState.private.ignored', []),
    get(state, 'favorite.folderState.public.ignored', []),
    get(state, 'favorite.folderState.team.ignored', [])
  )

  const folder = folders.find(f => f.path === routeProps.get('path'))

  return {
    path: routeProps.get('path'),
    folder,
    username: state.config && state.config.username,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  favoriteFolder: path => dispatch(FavoriteGen.createFavoriteAdd({path})),
  ignoreFolder: path => dispatch(FavoriteGen.createFavoriteIgnore({path})),
  navigateAppend: route => dispatch(navigateAppend(route)),
  navigateUp: () => dispatch(navigateUp()),
  openInKBFS: path => dispatch(KBFSGen.createOpen({path})),
  openTlfInChat: tlf => dispatch(ChatGen.createOpenTlfInChat({tlf})),
})

export default connect(mapStateToProps, mapDispatchToProps)(Files)
