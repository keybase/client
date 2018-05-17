// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {share, save} from './common.native'

function copyToDownloadDir(path: string, mime: string) {
  return new Promise((resolve, reject) => resolve())
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.share, share)
  yield Saga.safeTakeEvery(FsGen.save, save)
}

export {copyToDownloadDir, platformSpecificSaga}
