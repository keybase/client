// @flow
import * as AppGen from '../actions/app-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import * as KBFSGen from '../actions/kbfs-gen'
import Menubar from './index.render.desktop'
import openUrl from '../util/open-url'
import {connect, compose, type Dispatch} from '../util/container'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {defaultKBFSPath} from '../constants/config'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {loginTab, type Tab} from '../constants/tabs'
import {navigateTo, switchTo} from '../actions/route-tree'
import {shell, remote} from 'electron'
import {urlHelper} from '../util/url-helper'

const closeWindow = () => {
  remote.getCurrentWindow().hide()
}

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showUser: (username: string) => {
    const link = urlHelper('user', {username})
    link && openUrl(link)
  },
  logIn: () => {
    dispatch(AppGen.createShowMain())
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
    dispatch(AppGen.createShowMain())
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
    const link = urlHelper('help')
    link && openUrl(link)
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
