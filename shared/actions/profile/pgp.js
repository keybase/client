// @flow
import * as Constants from '../../constants/profile'
import {call, put, take, select} from 'redux-saga/effects'
import {safeTakeLatest, safeTakeEvery} from '../../util/saga'
import {isValidEmail, isValidName} from '../../util/simple-validators'
import {navigateTo, navigateAppend} from '../../actions/route-tree'
import {pgpPgpKeyGenDefaultRpcChannelMap, revokeRevokeKeyRpcPromise} from '../../constants/types/flow-types'
import {profileTab} from '../../constants/tabs'

import type {KID} from '../../constants/types/flow-types'
import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator} from '../../constants/types/saga'
import type {WaitingRevokeProof, FinishRevokeProof, UpdatePgpInfo, PgpInfo, GeneratePgp, FinishedWithKeyGen, DropPgp} from '../../constants/profile'

type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

function dropPgp (kid: KID): DropPgp {
  return {
    payload: {kid},
    type: Constants.dropPgp,
  }
}

function _revokedErrorResponse (error: string): FinishRevokeProof {
  return {
    error: true,
    payload: {error},
    type: Constants.finishRevokeProof,
  }
}

function _revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {
    payload: {waiting},
    type: Constants.waitingRevokeProof,
  }
}

function updatePgpInfo (pgpInfo: $Shape<PgpInfo>): UpdatePgpInfo {
  return {
    payload: pgpInfo,
    type: Constants.updatePgpInfo,
  }
}

function generatePgp (): GeneratePgp {
  return {
    payload: undefined,
    type: Constants.generatePgp,
  }
}

// This can be replaced with something that makes a call to service to validate
function _checkPgpInfoForErrors (pgpInfo: PgpInfo): PgpInfoError {
  const errorEmail1 = (pgpInfo.email1 && isValidEmail(pgpInfo.email1))
  const errorEmail2 = (pgpInfo.email2 && isValidEmail(pgpInfo.email2))
  const errorEmail3 = (pgpInfo.email3 && isValidEmail(pgpInfo.email3))
  const errorEmail1Message = errorEmail1 ? errorEmail1.message : null
  const errorEmail2Message = errorEmail2 ? errorEmail2.message : null
  const errorEmail3Message = errorEmail3 ? errorEmail3.message : null
  const errorName = isValidName(pgpInfo.fullName)
  const errorNameMessage = errorName ? errorName.message : null

  return {
    errorEmail1: !!errorEmail1,
    errorEmail2: !!errorEmail2,
    errorEmail3: !!errorEmail3,
    errorText: errorNameMessage || errorEmail1Message || errorEmail2Message || errorEmail3Message,
  }
}

function * _checkPgpInfo (action: UpdatePgpInfo): SagaGenerator<any, any> {
  if (action.error) { return }

  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)

  const errorUpdateAction: UpdatePgpInfo = {
    error: true,
    payload: _checkPgpInfoForErrors(pgpInfo),
    type: Constants.updatePgpInfo,
  }

  yield put(errorUpdateAction)
}
function * _dropPgpSaga (action: DropPgp): SagaGenerator<any, any> {
  if (action.error) { return }

  const kid = action.payload.kid

  try {
    yield put(_revokedWaitingForResponse(true))
    yield call(revokeRevokeKeyRpcPromise, {param: {keyID: kid}})
    yield put(_revokedWaitingForResponse(false))
    yield put(navigateTo([], [profileTab]))
  } catch (e) {
    yield put(_revokedWaitingForResponse(false))
    yield put(_revokedErrorResponse(`Error in dropping Pgp Key: ${e}`))
    console.log('error in dropping pgp key', e)
  }
}

// TODO(mm) handle error better
function * _generatePgpSaga (): SagaGenerator<any, any> {
  yield put(navigateAppend(['generate'], [profileTab, 'pgp']))

  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].filter(email => !!email).map(email => ({
    comment: '',
    email: email || '',
    username: pgpInfo.fullName || '',
  }))

  const generatePgpKeyChanMap = pgpPgpKeyGenDefaultRpcChannelMap([
    'keybase.1.pgpUi.keyGenerated',
    'keybase.1.pgpUi.shouldPushPrivate',
    'keybase.1.pgpUi.finished',
    'finished',
  ], {
    param: {
      createUids: {
        ids: identities,
        useDefault: false,
      },
    },
  })

  try {
    const incoming = yield generatePgpKeyChanMap.race({racers: {
      cancel: take(Constants.cancelPgpGen),
    }})

    if (incoming.cancel) {
      generatePgpKeyChanMap.close()
      yield put(navigateTo([], [profileTab]))
      return
    }

    yield call([incoming.keyGenerated.response, incoming.keyGenerated.response.result])
    const publicKey = incoming.keyGenerated.params.key.key

    yield put({payload: {publicKey}, type: Constants.updatePgpPublicKey})
    yield put(navigateAppend(['finished'], [profileTab, 'pgp']))

    const finishedAction: FinishedWithKeyGen = yield take(Constants.finishedWithKeyGen)
    const {shouldStoreKeyOnServer} = finishedAction.payload

    const {response} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.shouldPushPrivate')
    yield call([response, response.result], shouldStoreKeyOnServer)

    const {response: finishedResponse} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.finished')
    yield call([finishedResponse, finishedResponse.result])

    yield put(navigateTo([], [profileTab]))
  } catch (e) {
    generatePgpKeyChanMap.close()
    console.log('error in generating pgp key', e)
  }
}

function * pgpSaga (): SagaGenerator<any, any> {
  yield safeTakeLatest(a => (a && a.type === Constants.updatePgpInfo && !a.error), _checkPgpInfo)
  yield safeTakeLatest(Constants.generatePgp, _generatePgpSaga)
  yield safeTakeEvery(Constants.dropPgp, _dropPgpSaga)
}

export {
  pgpSaga,
  dropPgp,
  generatePgp,
  updatePgpInfo,
}
