// @flow
import * as Constants from '../../constants/profile'
import {call, put, take, race, select} from 'redux-saga/effects'
import {createChannelMap, putOnChannelMap, singleFixedChannelConfig, closeChannelMap, takeFromChannelMap} from '../../util/saga'
import {isValidEmail, isValidName} from '../../util/simple-validators'
import {navigateTo, routeAppend} from '../../actions/router'
import {pgpPgpKeyGenDefaultRpc, revokeRevokeKeyRpcPromise} from '../../constants/types/flow-types'
import {takeLatest, takeEvery} from 'redux-saga'

import type {KID} from '../../constants/types/flow-types'
import type {SagaGenerator, ChannelConfig, ChannelMap} from '../../constants/types/saga'
import type {WaitingRevokeProof, FinishRevokeProof, UpdatePgpInfo, PgpInfo, GeneratePgp, FinishedWithKeyGen, DropPgp} from '../../constants/profile'

type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

function dropPgp (kid: KID): DropPgp {
  return {
    type: Constants.dropPgp,
    payload: {kid},
  }
}

function _revokedErrorResponse (error: string): FinishRevokeProof {
  return {
    type: Constants.finishRevokeProof,
    payload: {error},
    error: true,
  }
}

function _revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {
    type: Constants.waitingRevokeProof,
    payload: {waiting},
  }
}

function updatePgpInfo (pgpInfo: $Shape<PgpInfo>): UpdatePgpInfo {
  return {
    type: Constants.updatePgpInfo,
    payload: pgpInfo,
  }
}

function generatePgp (): GeneratePgp {
  return {
    type: Constants.generatePgp,
    payload: undefined,
  }
}

// This can be replaced with something that makes a call to service to validate
function _checkPgpInfoForErrors (pgpInfo: PgpInfo): PgpInfoError {
  const errorEmail1 = (pgpInfo.email1 && isValidEmail(pgpInfo.email1))
  const errorEmail2 = (pgpInfo.email2 && isValidEmail(pgpInfo.email2))
  const errorEmail3 = (pgpInfo.email3 && isValidEmail(pgpInfo.email3))

  return {
    errorText: isValidName(pgpInfo.fullName) || errorEmail1 || errorEmail2 || errorEmail3,
    errorEmail1: !!errorEmail1,
    errorEmail2: !!errorEmail2,
    errorEmail3: !!errorEmail3,
  }
}

// Returns a channel that represents the feedback from the rpc service
// Things in the channel look like actions
// If the service expects a reply, a response will be attached to the payload
function _generatePgpKey (channelConfig: ChannelConfig<*>, pgpInfo: PgpInfo): any {
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].filter(email => !!email).map(email => ({
    username: pgpInfo.fullName || '',
    comment: '',
    email: email || '',
  }))

  const channelMap = createChannelMap(channelConfig)
  pgpPgpKeyGenDefaultRpc({
    param: {
      createUids: {
        useDefault: false,
        ids: identities,
      },
    },
    incomingCallMap: {
      'keybase.1.pgpUi.keyGenerated': ({kid, key}, response) => {
        putOnChannelMap(channelMap, 'keybase.1.pgpUi.keyGenerated', {params: {kid, key}, response})
      },
      'keybase.1.pgpUi.shouldPushPrivate': (p, response) => {
        putOnChannelMap(channelMap, 'keybase.1.pgpUi.shouldPushPrivate', {response})
      },
      'keybase.1.pgpUi.finished': (p, response) => {
        putOnChannelMap(channelMap, 'keybase.1.pgpUi.finished', {response})
      },
    },
    callback: (error) => {
      putOnChannelMap(channelMap, 'finished', {error})
      closeChannelMap(channelMap)
    },
  })

  return channelMap
}

function * _checkPgpInfo (action: UpdatePgpInfo): SagaGenerator<any, any> {
  if (action.error) { return }

  // $ForceType
  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)

  const errorUpdateAction: UpdatePgpInfo = {
    type: Constants.updatePgpInfo,
    error: true,
    payload: _checkPgpInfoForErrors(pgpInfo),
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
    yield put(navigateTo([]))
  } catch (e) {
    yield put(_revokedWaitingForResponse(false))
    yield put(_revokedErrorResponse(`Error in dropping Pgp Key: ${e}`))
    console.log('error in dropping pgp key', e)
  }
}

// TODO(mm) handle error better
function * _generatePgpSaga (): SagaGenerator<any, any> {
  yield put(routeAppend('generate'))

  const channelConfig = singleFixedChannelConfig(['keybase.1.pgpUi.keyGenerated', 'keybase.1.pgpUi.shouldPushPrivate', 'keybase.1.pgpUi.finished', 'finished'])

  // $ForceType
  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)
  // $ForceType
  const generatePgpKeyChanMap: ChannelMap<any> = yield call(_generatePgpKey, channelConfig, pgpInfo)

  try {
    // $ForceType
    const {cancel, keyGenerated}: {keyGenerated: any, cancel: ?any} = yield race({
      keyGenerated: takeFromChannelMap(generatePgpKeyChanMap, 'keybase.1.pgpUi.keyGenerated'),
      cancel: take(Constants.cancelPgpGen),
    })

    if (cancel) {
      closeChannelMap(generatePgpKeyChanMap)
      yield put(navigateTo([]))
      return
    }

    yield call([keyGenerated.response, keyGenerated.response.result])
    const publicKey = keyGenerated.params.key.key

    yield put({type: Constants.updatePgpPublicKey, payload: {publicKey}})
    yield put(routeAppend('finished'))

    // $ForceType
    const finishedAction: FinishedWithKeyGen = yield take(Constants.finishedWithKeyGen)
    const {shouldStoreKeyOnServer} = finishedAction.payload

    // $ForceType
    const {response} = yield takeFromChannelMap(generatePgpKeyChanMap, 'keybase.1.pgpUi.shouldPushPrivate')
    yield call([response, response.result], shouldStoreKeyOnServer)

    // $FlowIssue
    const {response: finishedResponse} = yield takeFromChannelMap(generatePgpKeyChanMap, 'keybase.1.pgpUi.finished')
    yield call([finishedResponse, finishedResponse.result])

    yield put(navigateTo([]))
  } catch (e) {
    closeChannelMap(generatePgpKeyChanMap)
    console.log('error in generating pgp key', e)
  }
}

function * pgpSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(a => (a && a.type === Constants.updatePgpInfo && !a.error), _checkPgpInfo),
    takeLatest(Constants.generatePgp, _generatePgpSaga),
    takeEvery(Constants.dropPgp, _dropPgpSaga),
  ]
}

export {
  pgpSaga,
  dropPgp,
  generatePgp,
  updatePgpInfo,
}
