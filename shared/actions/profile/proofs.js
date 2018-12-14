// @flow
import logger from '../../logger'
import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import {getEngine} from '../../engine'
import {peopleTab} from '../../constants/tabs'

const checkProof = (state, action: ProfileGen.CheckProofPayload) =>
  Saga.callUntyped(function*() {
    const sigID = state.profile.sigID
    if (!sigID) {
      return
    }

    try {
      const {found, status} = yield* Saga.callPromise(
        RPCTypes.proveCheckProofRpcPromise,
        {sigID},
        Constants.waitingKey
      )
      // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
      if (!found && status >= RPCTypes.proveCommonProofStatus.baseHardError) {
        yield Saga.put(
          ProfileGen.createUpdateErrorText({
            errorCode: null,
            errorText: "We couldn't find your proof. Please retry!",
          })
        )
      } else {
        yield Saga.put(ProfileGen.createUpdateProofStatus({found, status}))
        yield Saga.put(
          RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['confirmOrPending']})
        )
      }
    } catch (error) {
      logger.warn('Error getting proof update')
      yield Saga.put(
        ProfileGen.createUpdateErrorText({
          errorCode: null,
          errorText: "We couldn't verify your proof. Please retry!",
        })
      )
    }
  })

const addProof = (_, action: ProfileGen.AddProofPayload) => {
  // Special cases
  switch (action.payload.platform) {
    case 'dnsOrGenericWebSite':
      return Promise.resolve(
        RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['proveWebsiteChoice']})
      )
    case 'zcash':
      return Promise.resolve(
        RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['proveEnterUsername']})
      )
    case 'btc':
      return Promise.resolve(
        RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['proveEnterUsername']})
      )
    case 'pgp':
      return Promise.resolve(RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['pgp']}))
    default:
      return null // handled by addServiceProof
  }
}

const addServiceProof = (_, action: ProfileGen.AddProofPayload) =>
  Saga.callUntyped(function*() {
    const service = action.payload.platform
    switch (service) {
      case 'dnsOrGenericWebSite': // fallthrough
      case 'btc':
      case 'zcash':
      case 'pgp':
        return // already handled by addProof
    }

    let _promptUsernameResponse: ?Object = null
    let _outputInstructionsResponse: ?Object = null

    yield Saga.put(ProfileGen.createUpdateSigID({sigID: null}))

    const proveStartProofChanMap: any = RPCTypes.proveStartProofRpcChannelMap(
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

      // yield Saga.put(ProfileGen.createWaiting({waiting: false}))

      if (incoming.cancel) {
        proveStartProofChanMap.close()

        const InputCancelError = {
          code: RPCTypes.constantsStatusCode.scinputcanceled,
          desc: 'Cancel Add Proof',
        }
        if (_promptUsernameResponse) {
          getEngine().cancelRPC(_promptUsernameResponse, InputCancelError)
          _promptUsernameResponse = null
        }

        if (_outputInstructionsResponse) {
          getEngine().cancelRPC(_outputInstructionsResponse, InputCancelError)
          _outputInstructionsResponse = null
        }
        // yield Saga.put(ProfileGen.createWaiting({waiting: false}))
      } else if (incoming.submitUsername) {
        yield Saga.put(ProfileGen.createCleanupUsername())
        if (_promptUsernameResponse) {
          yield Saga.put(
            ProfileGen.createUpdateErrorText({
              errorCode: null,
              errorText: '',
            })
          )
          const state = yield* Saga.selectState()
          const username = state.profile.username
          _promptUsernameResponse.result(username)
          _promptUsernameResponse = null

          // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
        }
      } else if (incoming.checkProof) {
        if (!incoming.checkProof.sigID && _outputInstructionsResponse) {
          _outputInstructionsResponse.result()
          _outputInstructionsResponse = null
          // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
        }
      } else if (incoming['keybase.1.proveUi.promptUsername']) {
        _promptUsernameResponse = incoming['keybase.1.proveUi.promptUsername'].response
        if (incoming['keybase.1.proveUi.promptUsername'].params.prevError) {
          yield Saga.put(
            ProfileGen.createUpdateErrorText({
              errorCode: incoming['keybase.1.proveUi.promptUsername'].params.prevError.code,
              errorText: incoming['keybase.1.proveUi.promptUsername'].params.prevError.desc,
            })
          )
        }
        yield Saga.put(RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['proveEnterUsername']}))
      } else if (incoming['keybase.1.proveUi.outputInstructions']) {
        if (service === 'dnsOrGenericWebSite') {
          // We don't get this directly (yet) so we parse this out
          try {
            const match = incoming['keybase.1.proveUi.outputInstructions'].params.instructions.data.match(
              /<url>(http[s]+):\/\//
            )
            const protocol = match && match[1]
            yield Saga.put(
              ProfileGen.createUpdatePlatform({platform: protocol === 'https' ? 'https' : 'http'})
            )
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
        yield Saga.put(RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['postProof']}))
      } else if (incoming.finished) {
        yield Saga.put(ProfileGen.createUpdateSigID({sigID: incoming.finished.params.sigID}))
        if (incoming.finished.error) {
          logger.warn('Error making proof')
          yield Saga.put(
            ProfileGen.createUpdateErrorText({
              errorCode: incoming.finished.error.code,
              errorText: incoming.finished.error.desc,
            })
          )
        } else {
          logger.info('Start Proof done: ', incoming.finished.params.sigID)
          yield Saga.put(ProfileGen.createCheckProof())
        }
        break
      } else if (incoming['keybase.1.proveUi.promptOverwrite']) {
        incoming['keybase.1.proveUi.promptOverwrite'].response.result(true)
        // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      } else if (incoming['keybase.1.proveUi.outputPrechecks']) {
        incoming['keybase.1.proveUi.outputPrechecks'].response.result()
        // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      } else if (incoming['keybase.1.proveUi.preProofWarning']) {
        incoming['keybase.1.proveUi.preProofWarning'].response.result(true)
        // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      } else if (incoming['keybase.1.proveUi.okToCheck']) {
        incoming['keybase.1.proveUi.okToCheck'].response.result(true)
        // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      } else if (incoming['keybase.1.proveUi.displayRecheckWarning']) {
        incoming['keybase.1.proveUi.displayRecheckWarning'].response.result()
        // yield Saga.put(ProfileGen.createWaiting({waiting: true}))
      }
    }
  })

const cancelAddProof = state =>
  Promise.resolve(ProfileGen.createShowUserProfile({username: state.config.username}))

const submitCryptoAddress = (
  state,
  action: ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload
) =>
  Saga.callUntyped(function*() {
    if (!state.profile.usernameValid) {
      yield Saga.put(ProfileGen.createUpdateErrorText({errorCode: 0, errorText: 'Invalid address format'}))
      return
    }

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
      yield* Saga.callPromise(
        RPCTypes.cryptocurrencyRegisterAddressRpcPromise,
        {
          address,
          force: true,
          wantedFamily,
        },
        Constants.waitingKey
      )

      yield Saga.put(
        ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.proveCommonProofStatus.ok})
      )
      yield Saga.put(RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['confirmOrPending']}))
    } catch (error) {
      logger.warn('Error making proof')
      yield Saga.put(ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc}))
    }
  })

function* proofsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToAction([ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress], submitCryptoAddress)
  yield Saga.actionToPromise(ProfileGen.cancelAddProof, cancelAddProof)
  yield Saga.actionToPromise(ProfileGen.addProof, addProof)
  yield Saga.actionToAction(ProfileGen.addProof, addServiceProof)
  yield Saga.actionToAction(ProfileGen.checkProof, checkProof)
}

export {proofsSaga}
