// @flow
import logger from '../../logger'
import * as Flow from '../../util/flow'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {pickAndUploadToPromise} from './common.native'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

function* downloadSuccessToAction(state, action) {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta
  switch (intent) {
    case 'camera-roll':
      yield Saga.callUntyped(saveAttachmentDialog, localPath)
      yield Saga.put(FsGen.createDismissDownload({key}))
      break
    case 'share':
      yield Saga.callUntyped(showShareActionSheetFromURL, {mimeType, url: localPath})
      yield Saga.put(FsGen.createDismissDownload({key}))
      break
    case 'none':
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<FsGen.PickAndUploadPayload>(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainGenerator<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccessToAction)
}

export default platformSpecificSaga
