import type {OpenDialogOptions, SaveDialogOptions} from '../../util/electron.desktop'
import type * as RPCTypes from '../../constants/types/rpc-gen'

export type Action =
  | {type: 'appStartedUp'}
  | {
      type: 'activeChanged'
      payload: {
        changedAtMs: number
        isUserActive: boolean
      }
    }
  | {type: 'requestWindowsStartService'}
  | {type: 'closeWindows'}
  | {
      type: 'makeRenderer'
      payload: {
        windowComponent: string
        windowParam?: string
        windowOpts: {
          width: number
          height: number
        }
        windowPositionBottomRight?: boolean
      }
    }
  | {
      type: 'closeRenderer'
      payload: {
        windowComponent?: string
        windowParam?: string
      }
    }
  | {
      type: 'rendererNewProps'
      payload: {
        propsStr: string
        windowComponent: string
        windowParam: string
      }
    }
  | {type: 'showMainWindow'}
  | {type: 'showContextMenu'; payload: {url: string}}
  | {type: 'setupPreloadKB2'}
  | {type: 'winCheckRPCOwnership'}
  | {type: 'showOpenDialog'; payload: {options: OpenDialogOptions}}
  | {type: 'showSaveDialog'; payload: {options: SaveDialogOptions}}
  | {type: 'darwinCopyToKBFSTempUploadFile'; payload: {originalFilePath: string; dir: string}}
  | {type: 'darwinCopyToChatTempUploadFile'; payload: {originalFilePath: string; dst: string}}
  | {type: 'closeWindow'}
  | {type: 'minimizeWindow'}
  | {type: 'toggleMaximizeWindow'}
  | {type: 'openURL'; payload: {url: string; options?: {activate: boolean}}}
  | {type: 'showInactive'}
  | {type: 'hideWindow'}
  | {type: 'openPathInFinder'; payload: {path: string; isFolder: boolean}}
  | {type: 'getPathType'; payload: {path: string}}
  | {type: 'dumpNodeLogger'}
  | {type: 'quitApp'}
  | {type: 'exitApp'; payload: {code: number}}
  | {type: 'setOpenAtLogin'; payload: {enabled: boolean}}
  | {type: 'relaunchApp'}
  | {type: 'uninstallKBFSDialog'}
  | {type: 'uninstallDokanDialog'}
  | {type: 'selectFilesToUploadDialog'; payload: {parent: string | null; type: 'file' | 'directory' | 'both'}}
  | {type: 'ctlQuit'}
  | {
      type: 'windowsCheckMountFromOtherDokanInstall'
      payload: {
        mountPoint: string
        status: RPCTypes.FuseStatus
      }
    }
  | {type: 'isDirectory'; payload: {path: string}}
  | {type: 'copyToClipboard'; payload: {text: string}}
  | {type: 'readImageFromClipboard'}
  | {type: 'clipboardAvailableFormats'}
  | {type: 'installCachedDokan'}
  | {type: 'uninstallDokan'; payload: {execPath: string}}
  | {type: 'engineSend'; payload: {buf: Buffer}}
