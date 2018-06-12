// @flow
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../fs-gen'
import {shareNative, saveMedia, pickAndUpload, pickAndUploadSuccess} from './common.native'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'

function platformSpecificIntentEffect(
  intent: Types.TransferIntent,
  localPath: string,
  mimeType: string
): ?Saga.Effect {
  switch (intent) {
    case 'camera-roll':
      return Saga.call(saveAttachmentDialog, localPath)
    case 'share':
      return Saga.call(showShareActionSheet, {url: localPath, mimeType})
    case 'none':
    case 'web-view':
    case 'web-view-text':
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
  yield Saga.safeTakeEveryPure(FsGen.shareNative, shareNative)
  yield Saga.safeTakeEveryPure(FsGen.saveMedia, saveMedia)
  yield Saga.safeTakeEveryPure(FsGen.pickAndUpload, pickAndUpload, pickAndUploadSuccess)
}

export {platformSpecificIntentEffect, platformSpecificSaga}
