import * as Types from '../../constants/types/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'

const noAccessErrorCodes = [RPCTypes.StatusCode.scsimplefsnoaccess, RPCTypes.StatusCode.scteamnotfound]

export const errorToActionOrThrow = (
  error: any,
  path?: Types.Path
): FsGen.CheckKbfsDaemonRpcStatusPayload | FsGen.SetPathSoftErrorPayload | FsGen.SetTlfSoftErrorPayload => {
  if (error?.code === RPCTypes.StatusCode.sckbfsclienttimeout) {
    return FsGen.createCheckKbfsDaemonRpcStatus()
  }
  if (path && error?.code === RPCTypes.StatusCode.scsimplefsnotexist) {
    return FsGen.createSetPathSoftError({path, softError: Types.SoftError.Nonexistent})
  }
  if (path && noAccessErrorCodes.includes(error?.code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      return FsGen.createSetTlfSoftError({path: tlfPath, softError: Types.SoftError.NoAccess})
    }
  }
  throw error
}
