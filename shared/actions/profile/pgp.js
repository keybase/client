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
    yield* Saga.callPromise(RPCTypes.revokeRevokeKeyRpcPromise, {keyID: kid})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(navigateTo([], [peopleTab]))
  } catch (e) {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createRevokeFinishError({error: `Error in dropping Pgp Key: ${e}`}))
    logger.info('error in dropping pgp key', e)
  }
}

function generatePgp(state: TypedState) {
  const pgpInfo = state.profile.pgpInfo
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].filter(Boolean).map(email => ({
    comment: '',
    email: email || '',
    username: pgpInfo.fullName || '',
  }))

  const onKeyGenerated = ({key}) => Saga.put(ProfileGen.createUpdatePgpPublicKey({publicKey: key.key}))
  const onShouldPushPrivate = (_, response) => {
    return Saga.callUntyped(function*() {
      yield Saga.put(navigateTo([peopleTab, 'profile', 'pgp', 'provideInfo', 'generate', 'finished']))
      const action: ProfileGen.FinishedWithKeyGenPayload = yield Saga.take(ProfileGen.finishedWithKeyGen)
      response.result(action.payload.shouldStoreKeyOnServer)
      yield Saga.put(navigateTo([peopleTab, 'profile']))
    })
  }
  const onFinished = () => {}

  return Saga.callUntyped(function*() {
    yield Saga.put(navigateTo([peopleTab, 'profile', 'pgp', 'provideInfo', 'generate']))
    yield RPCTypes.pgpPgpKeyGenDefaultRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.pgpUi.shouldPushPrivate': onShouldPushPrivate,
      },
      incomingCallMap: {
        'keybase.1.pgpUi.finished': onFinished,
        'keybase.1.pgpUi.keyGenerated': onKeyGenerated,
      },
      params: {
        createUids: {
          ids: identities,
          useDefault: false,
        },
      },
    })
  })
}

function* pgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(a => a && a.type === ProfileGen.updatePgpInfo && !a.error, _checkPgpInfo)
  yield Saga.actionToAction(ProfileGen.generatePgp, generatePgp)
  yield Saga.safeTakeEvery(ProfileGen.dropPgp, _dropPgpSaga)
}

export {pgpSaga}
