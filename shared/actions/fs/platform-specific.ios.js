// @flow
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../fs-gen'
import {share, save} from './common.native'
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
  yield Saga.safeTakeEveryPure(FsGen.share, share)
  yield Saga.safeTakeEvery(FsGen.save, save)
}

export {platformSpecificIntentEffect, platformSpecificSaga}
