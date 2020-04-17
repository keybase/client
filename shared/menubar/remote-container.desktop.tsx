import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Electron from 'electron'
import * as SettingsGen from '../actions/settings-gen'
import * as Tabs from '../constants/tabs'
import * as Types from '../constants/types/fs'
import Menubar from './index.desktop'
import openUrl from '../util/open-url'
import throttle from 'lodash/throttle'
import {DeserializeProps} from './remote-serializer.desktop'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {isWindows, isDarwin, isLinux} from '../constants/platform'
import {quit} from '../desktop/app/ctl.desktop'
import {urlHelper} from '../util/url-helper'

const hideWindow = () => {
  Electron.remote.getCurrentWindow().hide()
}

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {config, ...rest} = state
  const {username} = config
  const dispatch = Container.useDispatch()

  return (
    <Menubar
      {...rest}
      {...config}
      onRetrySync={() => {
        // This LoadPathMetadata triggers a sync retry.
        dispatch(FsGen.createLoadPathMetadata({path: Types.stringToPath('/keybase/private' + name)}))
      }}
      showUser={() => {
        const link = urlHelper('user', {username})
        link && openUrl(link)
      }}
      logIn={() => {
        dispatch(ConfigGen.createShowMain())
        dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}))
      }}
      onHideDiskSpaceBanner={() => dispatch(FsGen.createShowHideDiskSpaceBanner({show: false}))}
      onRekey={() => {
        dispatch(createOpenRekeyPopup())
        hideWindow()
      }}
      openApp={(tab?: Tabs.AppTab) => {
        dispatch(ConfigGen.createShowMain())
        tab && dispatch(RouteTreeGen.createSwitchTab({tab}))
      }}
      quit={() => {
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
          quit()
        }, 2000)
      }}
      refreshUserFileEdits={throttle(() => dispatch(FsGen.createUserFileEditsLoad()), 1000 * 5)}
      showBug={() => {
        const version = __VERSION__
        Electron.remote.shell.openExternal(
          `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(
            version
          )}`
        )
      }}
      showHelp={() => {
        const link = urlHelper('help')
        link && openUrl(link)
        hideWindow()
      }}
      showInFinder={() => dispatch(FsGen.createOpenPathInSystemFileManager({path: FsConstants.defaultPath}))}
      updateNow={isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined}
    />
  )
}
export default RemoteContainer
