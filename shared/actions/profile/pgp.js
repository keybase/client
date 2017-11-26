// @flow
import * as Types from '../../constants/types/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import {isValidEmail, isValidName} from '../../util/simple-validators'
import {navigateTo, navigateAppend} from '../../actions/route-tree'
import {peopleTab} from '../../constants/tabs'
import type {TypedState} from '../../constants/reducer'

type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

// This can be replaced with something that makes a call to service to validate
function _checkPgpInfoForErrors(info: Types.PgpInfo): PgpInfoError {
  const errorEmail1 = info.email1 && isValidEmail(info.email1)
  const errorEmail2 = info.email2 && isValidEmail(info.email2)
  const errorEmail3 = info.email3 && isValidEmail(info.email3)
  const errorEmail1Message = errorEmail1 ? errorEmail1.message : null
  const errorEmail2Message = errorEmail2 ? errorEmail2.message : null
  const errorEmail3Message = errorEmail3 ? errorEmail3.message : null
  const errorName = isValidName(info.fullName)
  const errorNameMessage = errorName ? errorName.message : null

  return {
    errorEmail1: !!errorEmail1,
    errorEmail2: !!errorEmail2,
    errorEmail3: !!errorEmail3,
    errorText: errorNameMessage || errorEmail1Message || errorEmail2Message || errorEmail3Message,
  }
}

function* _checkPgpInfo(action: ProfileGen.UpdatePgpInfoPayload): Saga.SagaGenerator<any, any> {
  if (action.error) {
    return
  }

  const state: TypedState = yield Saga.select()
  const {profile: {pgpInfo}} = state

  yield Saga.put(
    ProfileGen.createUpdatePgpInfoError({
      error: _checkPgpInfoForErrors(pgpInfo),
    })
  )
}
function* _dropPgpSaga(action: ProfileGen.DropPgpPayload): Saga.SagaGenerator<any, any> {
  if (action.error) {
    return
  }

  const kid = action.payload.kid

  try {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: true}))
    yield Saga.call(RPCTypes.revokeRevokeKeyRpcPromise, {keyID: kid})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(navigateTo([], [peopleTab]))
  } catch (e) {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createRevokeFinishError({error: `Error in dropping Pgp Key: ${e}`}))
    console.log('error in dropping pgp key', e)
  }
}

// TODO(mm) handle error better
function* _generatePgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(navigateAppend(['generate'], [peopleTab, 'pgp']))

  const state: TypedState = yield Saga.select()
  const {profile: {pgpInfo}} = state
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].filter(email => !!email).map(email => ({
    comment: '',
    email: email || '',
    username: pgpInfo.fullName || '',
  }))

  const generatePgpKeyChanMap = RPCTypes.pgpPgpKeyGenDefaultRpcChannelMap(
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

    yield Saga.call([
      incoming['keybase.1.pgpUi.keyGenerated'].response,
      incoming['keybase.1.pgpUi.keyGenerated'].response.result,
    ])
    const publicKey = incoming['keybase.1.pgpUi.keyGenerated'].params.key.key

    yield Saga.put(ProfileGen.createUpdatePgpPublicKey({publicKey}))
    yield Saga.put(navigateAppend(['finished'], [peopleTab, 'pgp']))

    const finishedAction: ProfileGen.FinishedWithKeyGenPayload = yield Saga.take(
      ProfileGen.finishedWithKeyGen
    )
    const {shouldStoreKeyOnServer} = finishedAction.payload

    const {response} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.shouldPushPrivate')
    yield Saga.call([response, response.result], shouldStoreKeyOnServer)

    const {response: finishedResponse} = yield generatePgpKeyChanMap.take('keybase.1.pgpUi.finished')
    yield Saga.call([finishedResponse, finishedResponse.result])

    yield Saga.put(navigateTo([], [peopleTab]))
  } catch (e) {
    generatePgpKeyChanMap.close()
    console.log('error in generating pgp key', e)
  }
}

function* pgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(a => a && a.type === ProfileGen.updatePgpInfo && !a.error, _checkPgpInfo)
  yield Saga.safeTakeLatest(ProfileGen.generatePgp, _generatePgpSaga)
  yield Saga.safeTakeEvery(ProfileGen.dropPgp, _dropPgpSaga)
}

export {pgpSaga}
