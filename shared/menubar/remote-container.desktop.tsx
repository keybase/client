import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SettingsGen from '../actions/settings-gen'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
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
      username={username}
      hideWindow={hideWindow}
      windowShownCount={windowShownCount.get('menu') ?? 0}
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
      updateNow={isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined}
    />
  )
}
export default RemoteContainer
