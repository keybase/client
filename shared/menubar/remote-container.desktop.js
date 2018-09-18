// @flow
import * as ConfigGen from '../actions/config-gen'
import * as FsGen from '../actions/fs-gen'
import Menubar from './index.desktop'
import openUrl from '../util/open-url'
import {remoteConnect} from '../util/container'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {loginTab, type Tab} from '../constants/tabs'
import {navigateTo, switchTo} from '../actions/route-tree'
import * as SafeElectron from '../util/safe-electron.desktop'
import {urlHelper} from '../util/url-helper'

const closeWindow = () => {
  SafeElectron.getRemote()
    .getCurrentWindow()
    .hide()
}

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
  _showUser: (username: string) => {
    const link = urlHelper('user', {username})
    link && openUrl(link)
  },
  logIn: () => {
    dispatch(ConfigGen.createShowMain())
    dispatch(navigateTo([loginTab]))
  },
  onRekey: () => {
    dispatch(createOpenRekeyPopup())
    closeWindow()
  },
  openApp: (tab?: Tab) => {
    dispatch(ConfigGen.createShowMain())
    tab && dispatch(switchTo([tab]))
  },
  quit: () => {
    closeWindow()
    dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
    // In case dump log doens't exit for us
    setTimeout(() => {
      executeActionsForContext('quitButton')
    }, 2000)
  },
  refresh: () => dispatch(FsGen.createUserFileEditsLoad()),
  showBug: () => {
    const version = __VERSION__ // eslint-disable-line no-undef
    SafeElectron.getShell().openExternal(
      `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(
        version
      )}`
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
export default remoteConnect(state => state, mapDispatchToProps, mergeProps)(Menubar)
