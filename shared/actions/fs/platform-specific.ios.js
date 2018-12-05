// @flow
import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {type TypedState} from '../../util/container'
import {pickAndUploadToPromise} from './common.native'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

const downloadSuccessToAction = (state: TypedState, action: FsGen.DownloadSuccessPayload) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return null
  }
  const {intent, localPath} = download.meta
  switch (intent) {
    case 'camera-roll':
      return Saga.sequentially([
        Saga.call(saveAttachmentDialog, localPath),
        Saga.put(FsGen.createDismissDownload({key})),
      ])
    case 'share':
      return Saga.sequentially([
        Saga.call(showShareActionSheetFromURL, {mimeType, url: localPath}),
        Saga.put(FsGen.createDismissDownload({key})),
      ])
    case 'none':
      return null
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(intent);
      */
      return null
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield Saga.actionToAction(FsGen.downloadSuccess, downloadSuccessToAction)
}

export default platformSpecificSaga
