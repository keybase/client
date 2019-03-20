// @flow
import logger from '../../logger'
import * as Constants from '../../constants/profile'
import type {RPCError} from '../../util/errors'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as More from '../../constants/types/more'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tracker2Gen from '../tracker2-gen'
import {peopleTab} from '../../constants/tabs'
import flags from '../../util/feature-flags'

const checkProof = (state, action) => {
  const sigID = state.profile.sigID
  if (!sigID) {
    return
  }

  return RPCTypes.proveCheckProofRpcPromise({sigID}, Constants.waitingKey)
    .then(({found, status}) => {
      // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
      if (!found && status >= RPCTypes.proveCommonProofStatus.baseHardError) {
        return ProfileGen.createUpdateErrorText({
          errorCode: null,
          errorText: "We couldn't find your proof. Please retry!",
        })
      } else {
        return [
          ProfileGen.createUpdateProofStatus({found, status}),
          RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['profileConfirmOrPending']}),
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

const recheckProof = (state, action) =>
  RPCTypes.proveCheckProofRpcPromise({sigID: action.payload.sigID}, Constants.waitingKey).then(() =>
    Tracker2Gen.createShowUser({asTracker: false, username: state.config.username})
  )

// only let one of these happen at a time
let addProofInProgress = false
function* addProof(_, action) {
  const service = action.payload.platform
  // Special cases
  switch (service) {
    case 'dnsOrGenericWebSite':
      yield Saga.put(
        RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['profileProveWebsiteChoice']})
      )
      return
    case 'zcash': //  fallthrough
    case 'btc':
      yield Saga.put(
        RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['profileProveEnterUsername']})
      )
      return
    case 'pgp':
      yield Saga.put(RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['profilePgp']}))
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
    code: RPCTypes.constantsStatusCode.scinputcanceled,
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
        const state = yield* Saga.selectState()
        _promptUsernameResponse.result(state.profile.username)
        _promptUsernameResponse = null
      }
    }
  })

  const promptUsername = ({prevError}, response) => {
    // TODO get parameters from this
    if (canceled) {
      cancelResponse(response)
      return
    }

    _promptUsernameResponse = response
    const actions = []
    if (prevError) {
      actions.push(
        Saga.put(ProfileGen.createUpdateErrorText({errorCode: prevError.code, errorText: prevError.desc}))
      )
    }
    if (More.PlatformsExpanded.includes(service)) {
      actions.push(
        Saga.put(
          RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['profileProveEnterUsername']})
        )
      )
    } else {
      actions.push(Saga.put(RouteTreeGen.createNavigateAppend({path: ['profileGenericEnterUsername']})))
    }
    return actions
  }

  const outputInstructions = ({instructions, proof}, response) => {
    if (canceled) {
      cancelResponse(response)
      return
    }

    const actions = []
    _outputInstructionsResponse = response
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

    actions.push(Saga.put(ProfileGen.createUpdateProofText({proof})))
    actions.push(
      Saga.put(RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['profilePostProof']}))
    )
    return actions
  }

  const responseYes = (_, response) => response.result(true)

  try {
    const {sigID} = yield RPCTypes.proveStartProofRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.proveUi.okToCheck': responseYes,
        'keybase.1.proveUi.outputInstructions': outputInstructions,
        'keybase.1.proveUi.preProofWarning': responseYes,
        'keybase.1.proveUi.promptOverwrite': responseYes,
        'keybase.1.proveUi.promptUsername': promptUsername,
      },
      incomingCallMap: {
        'keybase.1.proveUi.checking': () => {},
        'keybase.1.proveUi.displayRecheckWarning': () => {},
        'keybase.1.proveUi.outputPrechecks': () => {},
      },
      params: {
        auto: false,
        force: true,
        promptPosted: false,
        service,
        username: '',
      },
      waitingKey: Constants.waitingKey,
    })
    yield Saga.put(ProfileGen.createUpdateSigID({sigID}))
    logger.info('Start Proof done: ', sigID)
    yield Saga.put(ProfileGen.createCheckProof())
  } catch (error) {
    logger.warn('Error making proof')
    yield Saga.put(ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc}))
  }
  cancelTask.cancel()
  checkProofTask.cancel()
  submitUsernameTask.cancel()
  addProofInProgress = false
}

const cancelAddProof = state =>
  !flags.useNewRouter && ProfileGen.createShowUserProfile({username: state.config.username})

const submitCryptoAddress = (state, action) => {
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
      ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.proveCommonProofStatus.ok}),
      RouteTreeGen.createNavigateAppend({parentPath: [peopleTab], path: ['profileConfirmOrPending']}),
    ])
    .catch((error: RPCError) => {
      logger.warn('Error making proof')
      return ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc})
    })
}

function* proofsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload>(
    [ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress],
    submitCryptoAddress
  )
  yield* Saga.chainAction<ProfileGen.CancelAddProofPayload>(ProfileGen.cancelAddProof, cancelAddProof)
  yield* Saga.chainGenerator<ProfileGen.AddProofPayload>(ProfileGen.addProof, addProof)
  yield* Saga.chainAction<ProfileGen.CheckProofPayload>(ProfileGen.checkProof, checkProof)
  yield* Saga.chainAction<ProfileGen.RecheckProofPayload>(ProfileGen.recheckProof, recheckProof)
}

export {proofsSaga}
