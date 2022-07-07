import * as Constants from '../../constants/profile'
import * as Container from '../../util/container'
import * as DeeplinksGen from '../deeplinks-gen'
import * as More from '../../constants/types/more'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tracker2Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../tracker2-gen'
import logger from '../../logger'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'

type ValidCallback =
  | 'keybase.1.proveUi.checking'
  | 'keybase.1.proveUi.continueChecking'
  | 'keybase.1.proveUi.okToCheck'
  | 'keybase.1.proveUi.outputInstructions'
  | 'keybase.1.proveUi.preProofWarning'
  | 'keybase.1.proveUi.promptOverwrite'
  | 'keybase.1.proveUi.promptUsername'

type CustomResp<T extends ValidCallback> = {
  error: RPCTypes.IncomingErrorCallback
  result: (res: RPCTypes.MessageTypes[T]['outParam']) => void
}

const checkProof = async (state: Container.TypedState) => {
  const sigID = state.profile.sigID
  const isGeneric = !!state.profile.platformGeneric
  if (!sigID) {
    return
  }

  try {
    const {found, status} = await RPCTypes.proveCheckProofRpcPromise({sigID}, Constants.waitingKey)
    // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
    if (!found && status >= RPCTypes.ProofStatus.baseHardError) {
      return ProfileGen.createUpdateErrorText({
        errorText: "We couldn't find your proof. Please retry!",
      })
    } else {
      return [
        ProfileGen.createUpdateErrorText({
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
  } catch (_) {
    logger.warn('Error getting proof update')
    return ProfileGen.createUpdateErrorText({
      errorText: "We couldn't verify your proof. Please retry!",
    })
  }
}

const recheckProof = async (state: Container.TypedState, action: ProfileGen.RecheckProofPayload) => {
  await RPCTypes.proveCheckProofRpcPromise({sigID: action.payload.sigID}, Constants.waitingKey)
  return Tracker2Gen.createShowUser({asTracker: false, username: state.config.username})
}

// only let one of these happen at a time
let addProofInProgress = false
const addProof = async (
  state: Container.TypedState,
  action: ProfileGen.AddProofPayload,
  listenerApi: Container.ListenerApi
) => {
  const service = More.asPlatformsExpandedType(action.payload.platform)
  const genericService = service ? null : action.payload.platform
  // Special cases
  switch (service) {
    case 'dnsOrGenericWebSite':
      return RouteTreeGen.createNavigateAppend({path: ['profileProveWebsiteChoice']})
    case 'zcash': //  fallthrough
    case 'btc':
      return RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']})
    case 'pgp':
      return RouteTreeGen.createNavigateAppend({path: ['profilePgp']})
  }

  if (addProofInProgress) {
    logger.warn('addProof while one in progress')
    return
  }
  addProofInProgress = true
  let _promptUsernameResponse: CustomResp<'keybase.1.proveUi.promptUsername'> | undefined
  let _outputInstructionsResponse: CustomResp<'keybase.1.proveUi.outputInstructions'> | undefined

  const inputCancelError = {
    code: RPCTypes.StatusCode.scinputcanceled,
    desc: 'Cancel Add Proof',
  }

  listenerApi.dispatch(ProfileGen.createUpdateSigID({}))

  let canceled = false

  // We fork off some tasks for watch for events that come from the ui
  const cancelTask = listenerApi.fork(async () => {
    await listenerApi.take(action => action.type === ProfileGen.cancelAddProof)
    canceled = true
    if (_promptUsernameResponse) {
      _promptUsernameResponse.error(inputCancelError)
      _promptUsernameResponse = undefined
    }

    if (_outputInstructionsResponse) {
      _outputInstructionsResponse.error(inputCancelError)
      _outputInstructionsResponse = undefined
    }
  })

  const checkProofTask = listenerApi.fork(async () => {
    // eslint-disable-next-line
    while (true) {
      await listenerApi.take(action => action.type === ProfileGen.checkProof)
      if (_outputInstructionsResponse) {
        _outputInstructionsResponse.result()
        _outputInstructionsResponse = undefined
      }
    }
  })

  const submitUsernameTask = listenerApi.fork(async () => {
    // loop since if we get errors we can get these events multiple times
    // eslint-disable-next-line
    while (true) {
      await listenerApi.take(action => action.type === ProfileGen.submitUsername)
      listenerApi.dispatch(ProfileGen.createCleanupUsername())
      if (_promptUsernameResponse) {
        listenerApi.dispatch(ProfileGen.createUpdateErrorText({errorText: ''}))
        const state = listenerApi.getState()
        _promptUsernameResponse.result(state.profile.username)
        _promptUsernameResponse = undefined
      }
    }
  })

  const loadAfter = Tracker2Gen.createLoad({
    assertion: state.config.username,
    guiID: Tracker2Constants.generateGUIID(),
    inTracker: false,
    reason: '',
  })
  try {
    const {sigID} = await RPCTypes.proveStartProofRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.proveUi.checking': (_, response) => {
            if (canceled) {
              response.error(inputCancelError)
              return
            }
            response.result()
            return ProfileGen.createUpdatePlatformGenericChecking({checking: true})
          },
          // service calls in when it polls to give us an opportunity to cancel
          'keybase.1.proveUi.continueChecking': (_, response) =>
            canceled ? response.result(false) : response.result(true),
          'keybase.1.proveUi.okToCheck': (_, response) => response.result(true),
          'keybase.1.proveUi.outputInstructions': ({instructions, proof}, response) => {
            if (canceled) {
              response.error(inputCancelError)
              return
            }

            const actions: Array<Container.TypedActions> = []
            _outputInstructionsResponse = response
            // @ts-ignore propbably a real thing
            if (service === 'dnsOrGenericWebSite') {
              // We don't get this directly (yet) so we parse this out
              try {
                const match = instructions.data.match(/<url>(http[s]+):\/\//)
                const protocol = match?.[1]
                actions.push(
                  ProfileGen.createUpdatePlatform({platform: protocol === 'https' ? 'https' : 'http'})
                )
              } catch (_) {
                actions.push(ProfileGen.createUpdatePlatform({platform: 'http'}))
              }
            }

            if (service) {
              actions.push(ProfileGen.createUpdateProofText({proof}))
              actions.push(RouteTreeGen.createNavigateAppend({path: ['profilePostProof']}))
            } else if (proof) {
              actions.push(ProfileGen.createUpdatePlatformGenericURL({url: proof}))
              openURL(proof)
              actions.push(ProfileGen.createCheckProof())
            }
            return actions
          },
          'keybase.1.proveUi.preProofWarning': (_, response) => response.result(true),
          'keybase.1.proveUi.promptOverwrite': (_, response) => response.result(true),
          'keybase.1.proveUi.promptUsername': (args, response) => {
            const {parameters, prevError} = args
            if (canceled) {
              response.error(inputCancelError)
              return
            }

            _promptUsernameResponse = response
            const actions: Array<Container.TypedActions> = []
            if (prevError) {
              actions.push(
                ProfileGen.createUpdateErrorText({errorCode: prevError.code, errorText: prevError.desc})
              )
            }
            if (service) {
              actions.push(RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']}))
            } else if (genericService && parameters) {
              actions.push(
                ProfileGen.createProofParamsReceived({params: Constants.toProveGenericParams(parameters)})
              )
              actions.push(RouteTreeGen.createNavigateAppend({path: ['profileGenericEnterUsername']}))
            }
            return actions
          },
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
      },
      listenerApi
    )
    listenerApi.dispatch(ProfileGen.createUpdateSigID({sigID}))
    logger.info('Start Proof done: ', sigID)
    if (!genericService) {
      listenerApi.dispatch(ProfileGen.createCheckProof())
    }
    listenerApi.dispatch(loadAfter)
    if (genericService) {
      listenerApi.dispatch(ProfileGen.createUpdatePlatformGenericChecking({checking: false}))
    }
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('Error making proof')
      listenerApi.dispatch(loadAfter)
      listenerApi.dispatch(ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc}))
      if (error.code === RPCTypes.StatusCode.scgeneric && action.payload.reason === 'appLink') {
        listenerApi.dispatch(
          DeeplinksGen.createSetKeybaseLinkError({
            error:
              "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated.",
          })
        )
        listenerApi.dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
          })
        )
      }
    }
    if (genericService) {
      listenerApi.dispatch(ProfileGen.createUpdatePlatformGenericChecking({checking: false}))
    }
  }
  cancelTask.cancel()
  checkProofTask.cancel()
  submitUsernameTask.cancel()
  addProofInProgress = false
  return
}

const submitCryptoAddress = async (
  state: Container.TypedState,
  action: ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload
) => {
  if (!state.profile.usernameValid) {
    return ProfileGen.createUpdateErrorText({errorCode: 0, errorText: 'Invalid address format'})
  }

  const address = state.profile.username

  let wantedFamily: 'bitcoin' | 'zcash' | undefined
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
    await RPCTypes.cryptocurrencyRegisterAddressRpcPromise(
      {address, force: true, wantedFamily},
      Constants.waitingKey
    )
    return [
      ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.ProofStatus.ok}),
      RouteTreeGen.createNavigateAppend({path: ['profileConfirmOrPending']}),
    ]
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('Error making proof')
      return ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc})
    }
    return
  }
}

export const initProofs = () => {
  Container.listenAction([ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress], submitCryptoAddress)
  Container.listenAction(ProfileGen.addProof, addProof)
  Container.listenAction(ProfileGen.checkProof, checkProof)
  Container.listenAction(ProfileGen.recheckProof, recheckProof)
}
