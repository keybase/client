import * as Types from '../../constants/types/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'

const noAccessErrorCodes = [
  RPCTypes.StatusCode.scsimplefsnoaccess,
  RPCTypes.StatusCode.scteamnotfound,
  RPCTypes.StatusCode.scteamreaderror,
]

export const errorToActionOrThrow = (
  error: any,
  path?: Types.Path
):
  | null
  | FsGen.RedbarPayload
  | FsGen.CheckKbfsDaemonRpcStatusPayload
  | FsGen.SetPathSoftErrorPayload
  | FsGen.SetTlfSoftErrorPayload => {
  if (error?.code === RPCTypes.StatusCode.sckbfsclienttimeout) {
    return FsGen.createCheckKbfsDaemonRpcStatus()
  }
  if (error?.code === RPCTypes.StatusCode.scidentifiesfailed) {
    // This is specifically to address the situation where when user tries to
    // remove a shared TLF from their favorites but another user of the TLF has
    // deleted their account the subscribePath call cauused from the popup will
    // get SCIdentifiesFailed error. We can't do anything here so just move on.
    // (Ideally we'd be able to tell it's becaue the user was deleted, but we
    // don't have that from Go right now.)
    //
    // TODO: TRIAGE-2379 this should probably be ignored on Go side. We
    // already use fsGui identifyBehavior and there's no reason we should get
    // an identify error here.
    return null
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
  if (error?.code === RPCTypes.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    return FsGen.createRedbar({error: 'A user in this shared folder has deleted their account.'})
  }
  throw error
}
