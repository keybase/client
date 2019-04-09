// @flow
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as FsGen from '../actions/fs-gen'
import Menubar from './index.desktop'
import openUrl from '../util/open-url'
import {remoteConnect} from '../util/container'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {loginTab, type Tab} from '../constants/tabs'
import {throttle} from 'lodash-es'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SafeElectron from '../util/safe-electron.desktop'
import * as FsConstants from '../constants/fs'
import {urlHelper} from '../util/url-helper'
import {isWindows, isDarwin} from '../constants/platform'

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
    dispatch(RouteTreeGen.createNavigateTo({path: [loginTab]}))
  },
  onRekey: () => {
    dispatch(createOpenRekeyPopup())
    closeWindow()
  },
  openApp: (tab?: Tab) => {
    dispatch(ConfigGen.createShowMain())
    tab && dispatch(RouteTreeGen.createSwitchTo({path: [tab]}))
  },
  quit: () => {
    if (!__DEV__) {
      dispatch(SettingsGen.createStop({exitCode: RPCTypes.ctlExitCode.ok}))
    }
    closeWindow()
    dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
    // In case dump log doens't exit for us
    setTimeout(() => {
      executeActionsForContext('quitButton')
    }, 2000)
  },
  refreshUserFileEdits: throttle(() => dispatch(FsGen.createUserFileEditsLoad()), 1000 * 5),
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
  showInFinder: () => dispatch(FsGen.createOpenPathInSystemFileManager({path: FsConstants.defaultPath})),
  updateNow: isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    refreshUserFileEdits: dispatchProps.refreshUserFileEdits,
    showUser: () => dispatchProps._showUser(stateProps.username),
    ...ownProps,
  }
}
export default remoteConnect<{||}, any, _, _, _, _>(state => state, mapDispatchToProps, mergeProps)(Menubar)
