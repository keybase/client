// @flow
import logger from '../../logger'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import engine, {Engine} from '../../engine'
import {navigateTo, navigateAppend} from '../route-tree'
import {peopleTab} from '../../constants/tabs'

import type {NavigateTo} from '../../constants/types/route-tree'
import type {ProvablePlatformsType} from '../../constants/types/more'
import type {TypedState} from '../../constants/reducer'

const _askTextOrDNS = (): NavigateTo => navigateTo(['proveWebsiteChoice'], [peopleTab])
const _registerBTC = (): NavigateTo => navigateTo(['proveEnterUsername'], [peopleTab])
const _registerZcash = (): NavigateTo => navigateTo(['proveEnterUsername'], [peopleTab])

function* _checkProof(action: ProfileGen.CheckProofPayload): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const sigID = state.profile.sigID
  if (!sigID) {
    return
  }

  yield Saga.put(ProfileGen.createUpdateErrorText({}))

  try {
    yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    const {found, status} = yield Saga.call(RPCTypes.proveCheckProofRpcPromise, {sigID})
    yield Saga.put(ProfileGen.createWaiting({waiting: false}))

    // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
    if (!found && status >= RPCTypes.proveCommonProofStatus.baseHardError) {
      yield Saga.put(
        ProfileGen.createUpdateErrorText({
          errorText: "We couldn't find your proof. Please retry!",
        })
      )
    } else {
      yield Saga.put(ProfileGen.createUpdateProofStatus({found, status}))
      yield Saga.put(navigateAppend(['confirmOrPending'], [peopleTab]))
    }
  } catch (error) {
    yield Saga.put(ProfileGen.createWaiting({waiting: false}))
    logger.warn('Error getting proof update')
    yield Saga.put(
      ProfileGen.createUpdateErrorText({
        errorText: "We couldn't verify your proof. Please retry!",
        errorCode: null,
      })
    )
  }
}

function _addProof(action: ProfileGen.AddProofPayload) {
  const actions = [
    Saga.put(ProfileGen.createUpdatePlatform({platform: action.payload.platform})),
    Saga.put(ProfileGen.createUpdateErrorText({})),
  ]

  // Special cases
  switch (action.payload.platform) {
    case 'dnsOrGenericWebSite':
      actions.push(Saga.put(_askTextOrDNS()))
      break
    case 'zcash':
      actions.push(Saga.put(_registerZcash()))
      break
    case 'btc':
      actions.push(Saga.put(_registerBTC()))
      break
    // flow needs this for some reason
    case 'http':
    case 'https':
    case 'twitter':
    case 'facebook':
    case 'reddit':
    case 'github':
    case 'hackernews':
    case 'dns':
      actions.push(Saga.call(_addServiceProof, action.payload.platform))
      break
    case 'pgp':
      actions.push(Saga.put(navigateAppend(['pgp'], [peopleTab])))
  }

  return Saga.sequentially(actions)
}

function* _addServiceProof(service: ProvablePlatformsType): Saga.SagaGenerator<any, any> {
  let _promptUsernameResponse: ?Object = null
  let _outputInstructionsResponse: ?Object = null

  yield Saga.put(ProfileGen.createUpdateSigID({sigID: null}))

  const proveStartProofChanMap = RPCTypes.proveStartProofRpcChannelMap(
    [
      'keybase.1.proveUi.promptUsername',
      'keybase.1.proveUi.outputInstructions',
      'keybase.1.proveUi.promptOverwrite',
      'keybase.1.proveUi.outputPrechecks',
      'keybase.1.proveUi.preProofWarning',
      'keybase.1.proveUi.okToCheck',
      'keybase.1.proveUi.displayRecheckWarning',
      'finished',
    ],
    {
      auto: false,
      force: true,
      promptPosted: false,
      service,
      username: '',
      sigVersion: 0, // Default sigVersion will be used.
    }
  )

  while (true) {
    const incoming = yield proveStartProofChanMap.race({
      racers: {
        cancel: Saga.take(ProfileGen.cancelAddProof),
        checkProof: Saga.take(ProfileGen.checkProof),
        submitUsername: Saga.take(ProfileGen.submitUsername),
      },
    })

    yield Saga.put(ProfileGen.createWaiting({waiting: false}))

    if (incoming.cancel) {
      proveStartProofChanMap.close()

      const engineInst: Engine = yield Saga.call(engine)

      const InputCancelError = {code: RPCTypes.constantsStatusCode.scinputcanceled, desc: 'Cancel Add Proof'}
      if (_promptUsernameResponse) {
        yield Saga.call([engineInst, engineInst.cancelRPC], _promptUsernameResponse, InputCancelError)
        _promptUsernameResponse = null
      }

      if (_outputInstructionsResponse) {
        yield Saga.call([engineInst, engineInst.cancelRPC], _outputInstructionsResponse, InputCancelError)
        _outputInstructionsResponse = null
      }
      yield Saga.put(ProfileGen.createWaiting({waiting: false}))
    } else if (incoming.submitUsername) {
      yield Saga.put(ProfileGen.createCleanupUsername())
      if (_promptUsernameResponse) {
        yield Saga.put(ProfileGen.createUpdateErrorText({}))
        const state: TypedState = yield Saga.select()
        const username = state.profile.username
        _promptUsernameResponse.result(username)
        _promptUsernameResponse = null

        yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      }
    } else if (incoming.checkProof) {
      if (!incoming.checkProof.sigID && _outputInstructionsResponse) {
        _outputInstructionsResponse.result()
        _outputInstructionsResponse = null
        yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      }
    } else if (incoming['keybase.1.proveUi.promptUsername']) {
      _promptUsernameResponse = incoming['keybase.1.proveUi.promptUsername'].response
      if (incoming['keybase.1.proveUi.promptUsername'].params.prevError) {
        yield Saga.put(
          ProfileGen.createUpdateErrorText({
            errorText: incoming['keybase.1.proveUi.promptUsername'].params.prevError.desc,
            errorCode: incoming['keybase.1.proveUi.promptUsername'].params.prevError.code,
          })
        )
      }
      yield Saga.put(navigateTo(['proveEnterUsername'], [peopleTab]))
    } else if (incoming['keybase.1.proveUi.outputInstructions']) {
      // $FlowIssue
      if (service === 'dnsOrGenericWebSite') {
        // We don't get this directly (yet) so we parse this out
        try {
          const match = incoming['keybase.1.proveUi.outputInstructions'].params.instructions.data.match(
            /<url>(http[s]+):\/\//
          )
          const protocol = match && match[1]
          yield Saga.put(ProfileGen.createUpdatePlatform({platform: protocol === 'https' ? 'https' : 'http'}))
        } catch (_) {
          yield Saga.put(ProfileGen.createUpdatePlatform({platform: 'http'}))
        }
      }

      yield Saga.put(
        ProfileGen.createUpdateProofText({
          proof: incoming['keybase.1.proveUi.outputInstructions'].params.proof,
        })
      )
      _outputInstructionsResponse = incoming['keybase.1.proveUi.outputInstructions'].response
      yield Saga.put(navigateAppend(['postProof'], [peopleTab]))
    } else if (incoming.finished) {
      yield Saga.put(ProfileGen.createUpdateSigID({sigID: incoming.finished.params.sigID}))
      if (incoming.finished.error) {
        logger.warn('Error making proof')
        yield Saga.put(
          ProfileGen.createUpdateErrorText({
            errorText: incoming.finished.error.desc,
            errorCode: incoming.finished.error.code,
          })
        )
      } else {
        logger.info('Start Proof done: ', incoming.finished.params.sigID)
        yield Saga.put(ProfileGen.createCheckProof())
      }
      break
    } else if (incoming['keybase.1.proveUi.promptOverwrite']) {
      incoming['keybase.1.proveUi.promptOverwrite'].response.result(true)
      yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    } else if (incoming['keybase.1.proveUi.outputPrechecks']) {
      incoming['keybase.1.proveUi.outputPrechecks'].response.result()
      yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    } else if (incoming['keybase.1.proveUi.preProofWarning']) {
      incoming['keybase.1.proveUi.preProofWarning'].response.result(true)
      yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    } else if (incoming['keybase.1.proveUi.okToCheck']) {
      incoming['keybase.1.proveUi.okToCheck'].response.result(true)
      yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    } else if (incoming['keybase.1.proveUi.displayRecheckWarning']) {
      incoming['keybase.1.proveUi.displayRecheckWarning'].response.result()
      yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    }
  }
}

function _cancelAddProof(_, state: TypedState) {
  return Saga.sequentially([
    Saga.put(ProfileGen.createUpdateErrorText({})),
    Saga.put(ProfileGen.createShowUserProfile({username: state.config.username || ''})),
  ])
}

function* _submitCryptoAddress(
  action: ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload
): Saga.SagaGenerator<any, any> {
  yield Saga.put(ProfileGen.createCleanupUsername())
  const state: TypedState = yield Saga.select()
  const address = state.profile.username

  let wantedFamily
  switch (action.type) {
    case ProfileGen.submitBTCAddress:
      wantedFamily = 'bitcoin'
      break
    case ProfileGen.submitZcashAddress:
      wantedFamily = 'zcash'
      break
    default:
      throw new Error('Unknown wantedfamily')
  }

  try {
    yield Saga.put(ProfileGen.createWaiting({waiting: true}))
    yield Saga.call(RPCTypes.cryptocurrencyRegisterAddressRpcPromise, {
      address,
      force: true,
      wantedFamily,
      sigVersion: 0, // Default sigVersion will be used.
    })

    yield Saga.put(ProfileGen.createWaiting({waiting: false}))
    yield Saga.put(
      ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.proveCommonProofStatus.ok})
    )
    yield Saga.put(navigateAppend(['confirmOrPending'], [peopleTab]))
  } catch (error) {
    logger.warn('Error making proof')
    yield Saga.put(ProfileGen.createWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createUpdateErrorText({errorText: error.desc, errorCode: error.code}))
  }
}

function* proofsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery([ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress], _submitCryptoAddress)
  yield Saga.safeTakeEveryPure(ProfileGen.cancelAddProof, _cancelAddProof)
  yield Saga.safeTakeEveryPure(ProfileGen.addProof, _addProof)
  yield Saga.safeTakeEvery(ProfileGen.checkProof, _checkProof)
}

export {proofsSaga}
