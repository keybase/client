// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {copyToDownloadDir} from './platform-specific'
import {share, save} from './common.native'

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.share, share)
  yield Saga.safeTakeEvery(FsGen.save, save)
}

export {copyToDownloadDir, platformSpecificSaga}
