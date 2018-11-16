// @flow
import logger from '../../logger'
import * as Types from '../../constants/types/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import {isValidEmail, isValidName} from '../../util/simple-validators'
import {navigateTo} from '../../actions/route-tree'
import {peopleTab} from '../../constants/tabs'
import type {TypedState} from '../../constants/reducer'

// This can be replaced with something that makes a call to service to validate
function _checkPgpInfoForErrors(info: {...Types.PgpInfo, ...Types.PgpInfoError}): Types.PgpInfoError {
  const errorEmail1 = info.email1 && isValidEmail(info.email1)
  const errorEmail2 = info.email2 && isValidEmail(info.email2)
  const errorEmail3 = info.email3 && isValidEmail(info.email3)
  const errorName = isValidName(info.fullName)

  return {
    errorEmail1: !!errorEmail1,
    errorEmail2: !!errorEmail2,
    errorEmail3: !!errorEmail3,
    errorText: errorName || errorEmail1 || errorEmail2 || errorEmail3,
  }
}

function _checkPgpInfo(action: ProfileGen.UpdatePgpInfoPayload, state: TypedState) {
  const {pgpInfo} = state.profile

  return Saga.put(
    ProfileGen.createUpdatePgpInfoError({
      error: _checkPgpInfoForErrors(pgpInfo),
    })
  )
}
function* _dropPgpSaga(action: ProfileGen.DropPgpPayload): Saga.SagaGenerator<any, any> {
  const kid = action.payload.kid

  try {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: true}))
    yield Saga.call(RPCTypes.revokeRevokeKeyRpcPromise, {keyID: kid})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(navigateTo([], [peopleTab]))
  } catch (e) {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createRevokeFinishError({error: `Error in dropping Pgp Key: ${e}`}))
    logger.info('error in dropping pgp key', e)
  }
}

// TODO(mm) handle error better
function* _generatePgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(navigateTo([peopleTab, 'profile', 'pgp', 'provideInfo', 'generate']))

  const state: TypedState = yield Saga.select()
  const {
    profile: {pgpInfo},
  } = state
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].filter(email => !!email).map(email => ({
    comment: '',
    email: email || '',
    username: pgpInfo.fullName || '',
  }))

  const generatePgpKeyChanMap: any = RPCTypes.pgpPgpKeyGenDefaultRpcChannelMap(
    [
      'keybase.1.pgpUi.keyGenerated',
      'keybase.1.pgpUi.shouldPushPrivate',
      'keybase.1.pgpUi.finished',
      'finished',
    ],
    {
      createUids: {
        ids: identities,
        useDefault: false,
      },
    }
  )

  try {
    const incoming = yield generatePgpKeyChanMap.race({
      racers: {
        cancel: Saga.take(ProfileGen.cancelPgpGen),
      },
    })

    if (incoming.cancel) {
      generatePgpKeyChanMap.close()
      yield Saga.put(navigateTo([], [peopleTab]))
      return
    }

    if (incoming.finished && incoming.finished.error) {
      throw incoming.finished.error
    }

    if (!incoming['keybase.1.pgpUi.keyGenerated']) {
      throw new Error('KeyGeneration failed')
    }

    yield Saga.call([
      incoming['keybase.1.pgpUi.keyGenerated'].response,
      incoming['keybase.1.pgpUi.keyGenerated'].response.result,
    ])
    const publicKey = incoming['keybase.1.pgpUi.keyGenerated'].params.key.key

    yield Saga.put(ProfileGen.createUpdatePgpPublicKey({publicKey}))
    yield Saga.put(navigateTo([peopleTab, 'profile', 'pgp', 'provideInfo', 'generate', 'finished']))

    const finishedAction: ProfileGen.FinishedWithKeyGenPayload = yield Saga.take(
      ProfileGen.finishedWithKeyGen
    )
    const {shouldStoreKeyOnServer} = finishedAction.payload

    const {response} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.shouldPushPrivate')
    yield Saga.call([response, response.result], shouldStoreKeyOnServer)

    const {response: finishedResponse} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.finished')
    yield Saga.call([finishedResponse, finishedResponse.result])

    yield Saga.put(navigateTo([peopleTab, 'profile']))
  } catch (e) {
    generatePgpKeyChanMap.close()
    logger.info('error in generating pgp key', e)
    yield Saga.put(navigateTo([peopleTab, 'profile']))
    throw e
  }
}

function* pgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(a => a && a.type === ProfileGen.updatePgpInfo && !a.error, _checkPgpInfo)
  yield Saga.safeTakeEvery(ProfileGen.generatePgp, _generatePgpSaga)
  yield Saga.safeTakeEvery(ProfileGen.dropPgp, _dropPgpSaga)
}

export {pgpSaga}
