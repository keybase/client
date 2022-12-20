import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Tabs from '../constants/tabs'
import * as Types from '../constants/types/fs'
import Menubar from './index.desktop'
import openUrl from '../util/open-url'
import throttle from 'lodash/throttle'
import type {DeserializeProps} from './remote-serializer.desktop'
import {createOpenPopup as createOpenRekeyPopup} from '../actions/unlock-folders-gen'
import {isWindows, isDarwin, isLinux} from '../constants/platform'
import KB2 from '../util/electron.desktop'

const {hideWindow, ctlQuit} = KB2.functions

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {config, ...rest} = state
  const {username, windowShownCount} = config
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
        openUrl(`https://keybase.io/${username || ''}`)
      }}
      logIn={() => {
        dispatch(ConfigGen.createShowMain())
        dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}))
      }}
      windowShownCount={windowShownCount.get('menu') ?? 0}
      onHideDiskSpaceBanner={() => dispatch(FsGen.createShowHideDiskSpaceBanner({show: false}))}
      onRekey={() => {
        dispatch(createOpenRekeyPopup())
        hideWindow?.()
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
        hideWindow?.()
        setTimeout(() => {
          ctlQuit?.()
        }, 2000)
      }}
      refreshUserFileEdits={throttle(() => dispatch(FsGen.createUserFileEditsLoad()), 1000 * 5)}
      showBug={() => {
        const version = __VERSION__
        openUrl(
          `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(
            version
          )}`
        )
      }}
      showHelp={() => {
        openUrl('https://keybase.io/docs')
        hideWindow?.()
      }}
      showInFinder={() => dispatch(FsGen.createOpenPathInSystemFileManager({path: FsConstants.defaultPath}))}
      updateNow={isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined}
    />
  )
}
export default RemoteContainer
