import * as ConfigGen from '../actions/config-gen'
import * as FsGen from '../actions/fs-gen'
import Menubar from './index.desktop'
import openUrl from '../util/open-url'
import {remoteConnect} from '../util/container'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {quit, hideWindow} from '../util/quit-helper.desktop'
import {loginTab, AppTab} from '../constants/tabs'
import {throttle} from 'lodash-es'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SafeElectron from '../util/safe-electron.desktop'
import * as FsConstants from '../constants/fs'
import {urlHelper} from '../util/url-helper'
import {isWindows, isDarwin, isLinux} from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Types from '../constants/types/fs'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
  _onRetrySync: name => () =>
    // This LoadPathMetadata triggers a sync retry.
    dispatch(FsGen.createLoadPathMetadata({path: Types.stringToPath('/keybase/private' + name)})),
  _showUser: (username: string) => {
    const link = urlHelper('user', {username})
    link && openUrl(link)
  },
  logIn: () => {
    dispatch(ConfigGen.createShowMain())
    dispatch(RouteTreeGen.createNavigateAppend({path: [loginTab]}))
  },
  onHideDiskSpaceBanner: dispatch(FsGen.createShowHideDiskSpaceBanner({show: false})),
  onRekey: () => {
    dispatch(createOpenRekeyPopup())
    hideWindow()
  },
  openApp: (tab?: AppTab) => {
    dispatch(ConfigGen.createShowMain())
    tab && dispatch(RouteTreeGen.createSwitchTab({tab}))
  },
  quit: () => {
    if (!__DEV__) {
      if (isLinux) {
        dispatch(SettingsGen.createStop({exitCode: RPCTypes.ExitCode.ok}))
      } else {
        dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
      }
    }
    // In case dump log doesn't exit for us
    hideWindow()
    setTimeout(() => {
      quit('quitButton')
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
    hideWindow()
  },
  showInFinder: () => dispatch(FsGen.createOpenPathInSystemFileManager({path: FsConstants.defaultPath})),
  updateNow: isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined,
  waitForKbfsDaemon: throttle(() => dispatch(FsGen.createWaitForKbfsDaemon()), 1000 * 5),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onRetrySync: dispatchProps._onRetrySync(stateProps.username),
    showUser: () => dispatchProps._showUser(stateProps.username),
    ...ownProps,
  }
}
export default remoteConnect(state => state, mapDispatchToProps, mergeProps)(Menubar)
