import logger from '../../logger'
import * as Constants from '../../constants/profile'
import {RPCError} from '../../util/errors'
import * as DeeplinksGen from '../deeplinks-gen'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as More from '../../constants/types/more'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tracker2Gen from '../tracker2-gen'
import * as Tracker2Constants from '../../constants/tracker2'
import openURL from '../../util/open-url'
import {TypedState} from '../../util/container'

const checkProof = (state: TypedState, _: ProfileGen.CheckProofPayload) => {
  const sigID = state.profile.sigID
  const isGeneric = !!state.profile.platformGeneric
  if (!sigID) {
    return
  }

  return RPCTypes.proveCheckProofRpcPromise({sigID}, Constants.waitingKey)
    .then(({found, status}) => {
      // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
      if (!found && status >= RPCTypes.ProofStatus.baseHardError) {
        return ProfileGen.createUpdateErrorText({
          errorCode: null,
          errorText: "We couldn't find your proof. Please retry!",
        })
      } else {
        return [
          ProfileGen.createUpdateErrorText({
            errorCode: null,
            errorText: '',
          }),
          ProfileGen.createUpdateProofStatus({found, status}),
          ...(isGeneric
            ? []
            : [
                RouteTreeGen.createNavigateAppend({
                  path: ['profileConfirmOrPending'],
                }),
              ]),
        ]
      }
    })
    .catch((_: RPCError) => {
      logger.warn('Error getting proof update')
      return ProfileGen.createUpdateErrorText({
        errorCode: null,
        errorText: "We couldn't verify your proof. Please retry!",
      })
    })
}

const recheckProof = (state: TypedState, action: ProfileGen.RecheckProofPayload) =>
  RPCTypes.proveCheckProofRpcPromise({sigID: action.payload.sigID}, Constants.waitingKey).then(() =>
    Tracker2Gen.createShowUser({asTracker: false, username: state.config.username})
  )

// only let one of these happen at a time
let addProofInProgress = false
function* addProof(state: TypedState, action: ProfileGen.AddProofPayload) {
  const service = More.asPlatformsExpandedType(action.payload.platform)
  const genericService = service ? null : action.payload.platform
  // Special cases
  switch (service) {
    case 'dnsOrGenericWebSite':
      yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['profileProveWebsiteChoice']}))
      return
    case 'zcash': //  fallthrough
    case 'btc':
      yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']}))
      return
    case 'pgp':
      yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['profilePgp']}))
      return
  }

  if (addProofInProgress) {
    logger.warn('addProof while one in progress')
    return
  }
  addProofInProgress = true
  let _promptUsernameResponse
  let _outputInstructionsResponse

  const inputCancelError = {
    code: RPCTypes.StatusCode.scinputcanceled,
    desc: 'Cancel Add Proof',
  }

  yield Saga.put(ProfileGen.createUpdateSigID({sigID: null}))

  let canceled = false
  // TODO maybe remove engine cancelrpc?
  const cancelResponse = r => r.error(inputCancelError)

  // We fork off some tasks for watch for events that come from the ui
  const cancelTask = yield Saga._fork(function*() {
    yield Saga.take(ProfileGen.cancelAddProof)
    canceled = true
    if (_promptUsernameResponse) {
      cancelResponse(_promptUsernameResponse)
      _promptUsernameResponse = null
    }

    if (_outputInstructionsResponse) {
      cancelResponse(_outputInstructionsResponse)
      _outputInstructionsResponse = null
    }
  })

  const checkProofTask = yield Saga._fork(function*() {
    while (true) {
      yield Saga.take(ProfileGen.checkProof)
      if (_outputInstructionsResponse) {
        _outputInstructionsResponse.result()
        _outputInstructionsResponse = null
      }
    }
  })

  const submitUsernameTask = yield Saga._fork(function*() {
    // loop since if we get errors we can get these events multiple times
    while (true) {
      yield Saga.take(ProfileGen.submitUsername)
      yield Saga.put(ProfileGen.createCleanupUsername())
      if (_promptUsernameResponse) {
        yield Saga.put(
          ProfileGen.createUpdateErrorText({
            errorCode: null,
            errorText: '',
          })
        )
        const state: TypedState = yield* Saga.selectState()
        _promptUsernameResponse.result(state.profile.username)
        // eslint is confused i think
        // eslint-disable-next-line require-atomic-updates
        _promptUsernameResponse = null
      }
    }
  })

  const promptUsername = (args, response) => {
    const {parameters, prevError} = args
    if (canceled) {
      cancelResponse(response)
      return
    }

    _promptUsernameResponse = response
    const actions: Array<Saga.PutEffect> = []
    if (prevError) {
      actions.push(
        Saga.put(ProfileGen.createUpdateErrorText({errorCode: prevError.code, errorText: prevError.desc}))
      )
    }
    if (service) {
      actions.push(Saga.put(RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']})))
    } else if (genericService && parameters) {
      actions.push(
        Saga.put(ProfileGen.createProofParamsReceived({params: Constants.toProveGenericParams(parameters)}))
      )
      actions.push(Saga.put(RouteTreeGen.createNavigateAppend({path: ['profileGenericEnterUsername']})))
    }
    return actions
  }

  const outputInstructions = ({instructions, proof}, response) => {
    if (canceled) {
      cancelResponse(response)
      return
    }

    const actions: Array<Saga.PutEffect> = []
    _outputInstructionsResponse = response
    // @ts-ignore propbably a real thing
    if (service === 'dnsOrGenericWebSite') {
      // We don't get this directly (yet) so we parse this out
      try {
        const match = instructions.data.match(/<url>(http[s]+):\/\//)
        const protocol = match && match[1]
        actions.push(
          Saga.put(ProfileGen.createUpdatePlatform({platform: protocol === 'https' ? 'https' : 'http'}))
        )
      } catch (_) {
        actions.push(Saga.put(ProfileGen.createUpdatePlatform({platform: 'http'})))
      }
    }

    if (service) {
      actions.push(Saga.put(ProfileGen.createUpdateProofText({proof})))
      actions.push(Saga.put(RouteTreeGen.createNavigateAppend({path: ['profilePostProof']})))
    } else if (proof) {
      actions.push(Saga.put(ProfileGen.createUpdatePlatformGenericURL({url: proof})))
      openURL(proof)
      actions.push(Saga.put(ProfileGen.createCheckProof()))
    }
    return actions
  }

  const checking = (_, response) => {
    if (canceled) {
      cancelResponse(response)
      return
    }
    response.result()
    return [Saga.put(ProfileGen.createUpdatePlatformGenericChecking({checking: true}))]
  }

  // service calls in when it polls to give us an opportunity to cancel
  const continueChecking = (_, response) => (canceled ? response.result(false) : response.result(true))

  const responseYes = (_, response) => response.result(true)

  const loadAfter = Tracker2Gen.createLoad({
    assertion: state.config.username,
    guiID: Tracker2Constants.generateGUIID(),
    inTracker: false,
    reason: '',
  })
  try {
    const {sigID} = yield RPCTypes.proveStartProofRpcSaga({
      // @ts-ignore TODO fix
      customResponseIncomingCallMap: {
        'keybase.1.proveUi.checking': checking,
        'keybase.1.proveUi.continueChecking': continueChecking,
        'keybase.1.proveUi.okToCheck': responseYes,
        'keybase.1.proveUi.outputInstructions': outputInstructions,
        'keybase.1.proveUi.preProofWarning': responseYes,
        'keybase.1.proveUi.promptOverwrite': responseYes,
        'keybase.1.proveUi.promptUsername': promptUsername,
      },
      incomingCallMap: {
        'keybase.1.proveUi.displayRecheckWarning': () => {},
        'keybase.1.proveUi.outputPrechecks': () => {},
      },
      params: {
        auto: false,
        force: true,
        promptPosted: !!genericService, // proof protocol extended slightly for generic proofs
        service: action.payload.platform,
        username: '',
      },
      waitingKey: Constants.waitingKey,
    })
    yield Saga.put(ProfileGen.createUpdateSigID({sigID}))
    logger.info('Start Proof done: ', sigID)
    if (!genericService) {
      yield Saga.put(ProfileGen.createCheckProof())
    }
    yield Saga.put(loadAfter)
    if (genericService) {
      yield Saga.put(ProfileGen.createUpdatePlatformGenericChecking({checking: false}))
    }
  } catch (error) {
    logger.warn('Error making proof')
    yield Saga.put(loadAfter)
    yield Saga.put(ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc}))
    if (error.code === RPCTypes.StatusCode.scgeneric && action.payload.reason === 'appLink') {
      yield Saga.put(
        DeeplinksGen.createSetKeybaseLinkError({
          error:
            "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated.",
        })
      )
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
        })
      )
    }
    if (genericService) {
      yield Saga.put(ProfileGen.createUpdatePlatformGenericChecking({checking: false}))
    }
  }
  cancelTask.cancel()
  checkProofTask.cancel()
  submitUsernameTask.cancel()
  // eslint is confused i think
  // eslint-disable-next-line require-atomic-updates
  addProofInProgress = false
}

const submitCryptoAddress = (
  state: TypedState,
  action: ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload
) => {
  if (!state.profile.usernameValid) {
    return ProfileGen.createUpdateErrorText({errorCode: 0, errorText: 'Invalid address format'})
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

  return RPCTypes.cryptocurrencyRegisterAddressRpcPromise(
    {address, force: true, wantedFamily},
    Constants.waitingKey
  )
    .then(() => [
      ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.ProofStatus.ok}),
      RouteTreeGen.createNavigateAppend({path: ['profileConfirmOrPending']}),
    ])
    .catch((error: RPCError) => {
      logger.warn('Error making proof')
      return ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc})
    })
}

function* proofsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2([ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress], submitCryptoAddress)
  yield* Saga.chainGenerator<ProfileGen.AddProofPayload>(ProfileGen.addProof, addProof)
  yield* Saga.chainAction2(ProfileGen.checkProof, checkProof)
  yield* Saga.chainAction2(ProfileGen.recheckProof, recheckProof)
}

export {proofsSaga}
