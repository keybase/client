// @flow
import {connect, compose, type Dispatch} from '../util/container'
import * as KBFSGen from '../actions/kbfs-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import Menubar from './index.render.desktop'
import {defaultKBFSPath} from '../constants/config'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {loginTab, type Tab} from '../constants/tabs'
import {navigateTo, switchTo} from '../actions/route-tree'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {shell, ipcRenderer, remote} from 'electron'

const BrowserWindow = remote.BrowserWindow

const closeWindow = () => {
  BrowserWindow.getCurrentWindow().hide()
}

// Props are handled by remote-menubar.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showUser: (username: string) => {
    ipcRenderer.send('openURL', 'user', {username}) // TODO regular action
  },
  logIn: () => {
    ipcRenderer.send('showMain')
    dispatch(navigateTo([loginTab]))
  },
  onFolderClick: (path: ?string) => {
    dispatch(KBFSGen.createOpen({path: path || defaultKBFSPath}))
    closeWindow()
  },
  onRekey: () => {
    dispatch(createOpenRekeyPopup())
    closeWindow()
  },
  openApp: (tab?: Tab) => {
    ipcRenderer.send('showMain')
    tab && dispatch(switchTo([tab]))
  },
  quit: () => {
    executeActionsForContext('quitButton')
  },
  refresh: () => {
    dispatch(FavoriteGen.createFavoriteList())
  },
  showBug: () => {
    const version = __VERSION__ // eslint-disable-line no-undef
    shell.openExternal(
      `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(version)}`
    )
  },
  showHelp: () => {
    ipcRenderer.send('openURL', 'help') // TODO regular action
    closeWindow()
  },
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  showUser: () => dispatchProps._showUser(stateProps.username),
  ...ownProps,
})
export default compose(connect(state => state, mapDispatchToProps, mergeProps))(Menubar)
