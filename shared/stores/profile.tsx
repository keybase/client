import * as T from '@/constants/types'
import {generateGUIID, ignorePromise, wrapErrors} from '@/constants/utils'
import * as S from '@/constants/strings'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {openURL} from '@/util/misc'
import {RPCError} from '@/util/errors'
import {navToProfile, navigateAppend} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import type {useTrackerState} from '@/stores/tracker'
import {normalizeProofUsername} from '@/profile/proof-utils'

export type ProveGenericParams = {
  logoBlack: T.Tracker.SiteIconSet
  logoFull: T.Tracker.SiteIconSet
  title: string
  subtext: string
  suffix: string
  buttonLabel: string
}

export const makeProveGenericParams = (): ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

export const toProveGenericParams = (p: T.RPCGen.ProveParameters): T.Immutable<ProveGenericParams> => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

type GeneratePgpArgs = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

type Store = T.Immutable<{
}>

const initialStore: Store = {}

export type State = Store & {
  dispatch: {
    defer: {
      onTracker2GetDetails?: (username: string) => T.Tracker.Details | undefined
      onTracker2Load?: (
        params: Parameters<ReturnType<typeof useTrackerState.getState>['dispatch']['load']>[0]
      ) => void
      onTracker2ShowUser?: (username: string, asTracker: boolean, skipNav?: boolean) => void
      onTracker2UpdateResult?: (guiID: string, result: T.Tracker.DetailsState, reason?: string) => void
    }
    dynamic: {
      afterCheckProof?: () => void
      cancelAddProof?: () => void
      cancelPgpGen?: () => void
      finishedWithKeyGen?: (shouldStoreKeyOnServer: boolean) => void
      submitUsername?: (username: string) => void
    }
    addProof: (platform: string, reason: 'appLink' | 'profile') => void
    editAvatar: () => void
    generatePgp: (args: GeneratePgpArgs) => void
    resetState: () => void
    showUserProfile: (username: string) => void
  }
}

export const useProfileState = Z.createZustand<State>('profile', (set, get) => {
  const resetProofCallbacks = () => {
    set(s => {
      s.dispatch.dynamic.afterCheckProof = undefined
      s.dispatch.dynamic.cancelAddProof = defaultCancelAddProof
      s.dispatch.dynamic.submitUsername = undefined
    })
  }
  const defaultCancelAddProof = () => {
    resetProofCallbacks()
  }

  const resetPgpCallbacks = () => {
    set(s => {
      s.dispatch.dynamic.cancelPgpGen = undefined
      s.dispatch.dynamic.finishedWithKeyGen = undefined
    })
  }

  const checkProofAndNavigate = async (
    platform: T.More.PlatformsExpandedType,
    sigID: T.RPCGen.SigID,
    username: string,
    proofText: string
  ) => {
    try {
      const {found, status} = await T.RPCGen.proveCheckProofRpcPromise({sigID}, S.waitingKeyProfile)
      if (!found && status >= T.RPCGen.ProofStatus.baseHardError) {
        navigateAppend(
          {
            name: 'profilePostProof',
            params: {
              error: "We couldn't find your proof. Please retry!",
              platform,
              proofText,
              username,
            },
          },
          true
        )
      } else {
        navigateAppend({
          name: 'profileConfirmOrPending',
          params: {
            platform,
            proofFound: found,
            proofStatus: status,
            username,
          },
        })
      }
    } catch {
      logger.warn('Error getting proof update')
      navigateAppend(
        {
          name: 'profilePostProof',
          params: {
            error: "We couldn't verify your proof. Please retry!",
            platform,
            proofText,
            username,
          },
        },
        true
      )
    }
  }

  let addProofInProgress = false

  const dispatch: State['dispatch'] = {
    addProof: (platform, reason) => {
      if (addProofInProgress) {
        logger.warn('addProof while one in progress')
        return
      }

      const service = T.More.asPlatformsExpandedType(platform)
      const genericService = service ? null : platform

      switch (service) {
        case 'dnsOrGenericWebSite':
          navigateAppend('profileProveWebsiteChoice')
          return
        case 'zcash':
        case 'btc':
          navigateAppend({name: 'profileProveEnterUsername', params: {platform: service}})
          return
        case 'pgp':
          navigateAppend('profilePgp')
          return
        default:
          break
      }

      addProofInProgress = true

      const inputCancelError = {
        code: T.RPCGen.StatusCode.scinputcanceled,
        desc: 'Cancel Add Proof',
      }

      let canceled = false
      let currentUsername = ''
      let currentGenericParams = makeProveGenericParams()
      let currentProofText = ''

      const loadAfter = () =>
        get().dispatch.defer.onTracker2Load?.({
          assertion: useCurrentUserState.getState().username,
          guiID: generateGUIID(),
          inTracker: false,
          reason: '',
        })

      const f = async () => {
        try {
          const {sigID} = await T.RPCGen.proveStartProofRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.proveUi.checking': (_, response) => {
                if (canceled) {
                  response.error(inputCancelError)
                  return
                }
                response.result()
              },
              'keybase.1.proveUi.continueChecking': (_, response) =>
                canceled ? response.result(false) : response.result(true),
              'keybase.1.proveUi.okToCheck': (_, response) => response.result(true),
              'keybase.1.proveUi.outputInstructions': ({proof}, response) => {
                if (canceled) {
                  response.error(inputCancelError)
                  return
                }
                set(s => {
                  s.dispatch.dynamic.afterCheckProof = wrapErrors(() => {
                    set(s => {
                      s.dispatch.dynamic.afterCheckProof = undefined
                    })
                    response.result()
                  })
                  s.dispatch.dynamic.cancelAddProof = wrapErrors(() => {
                    resetProofCallbacks()
                    canceled = true
                    response.error(inputCancelError)
                  })
                })

                if (service && proof) {
                  currentProofText = proof
                  navigateAppend({
                    name: 'profilePostProof',
                    params: {
                      platform: service,
                      proofText: proof,
                      username: currentUsername,
                    },
                  })
                } else if (proof) {
                  navigateAppend(
                    {
                      name: 'profileGenericEnterUsername',
                      params: {
                        genericParams: currentGenericParams,
                        proofUrl: proof,
                        service: genericService ?? '',
                        username: currentUsername,
                      },
                    },
                    true
                  )
                  openURL(proof)
                  get().dispatch.dynamic.afterCheckProof?.()
                }
              },
              'keybase.1.proveUi.preProofWarning': (_, response) => response.result(true),
              'keybase.1.proveUi.promptOverwrite': (_, response) => response.result(true),
              'keybase.1.proveUi.promptUsername': (args, response) => {
                const {parameters, prevError} = args
                if (canceled) {
                  response.error(inputCancelError)
                  return
                }
                set(s => {
                  s.dispatch.dynamic.cancelAddProof = wrapErrors(() => {
                    resetProofCallbacks()
                    canceled = true
                    response.error(inputCancelError)
                  })
                  s.dispatch.dynamic.submitUsername = wrapErrors((username: string) => {
                    const {normalized} = normalizeProofUsername(service, username)
                    currentUsername = normalized
                    set(s => {
                      s.dispatch.dynamic.submitUsername = undefined
                    })
                    response.result(normalized)
                  })
                })

                if (service) {
                  navigateAppend(
                    {
                      name: 'profileProveEnterUsername',
                      params: {
                        error: prevError?.desc,
                        platform: service,
                        username: currentUsername || undefined,
                      },
                    },
                    true
                  )
                } else if (genericService && parameters) {
                  currentGenericParams = toProveGenericParams(parameters)
                  navigateAppend(
                    {
                      name: 'profileGenericEnterUsername',
                      params: {
                        error: prevError?.desc,
                        genericParams: currentGenericParams,
                        service: genericService,
                        username: currentUsername || undefined,
                      },
                    },
                    true
                  )
                }
              },
            },
            incomingCallMap: {
              'keybase.1.proveUi.displayRecheckWarning': () => {},
              'keybase.1.proveUi.outputPrechecks': () => {},
            },
            params: {
              auto: false,
              force: true,
              promptPosted: !!genericService,
              service: platform,
              username: '',
            },
            waitingKey: S.waitingKeyProfile,
          })

          logger.info('Start Proof done: ', sigID)
          loadAfter()

          if (service) {
            await checkProofAndNavigate(service, sigID, currentUsername, currentProofText)
          } else {
            navigateAppend(
              {
                name: 'profileGenericProofResult',
                params: {
                  genericParams: currentGenericParams,
                  username: currentUsername,
                },
              },
              true
            )
          }
        } catch (_error) {
          loadAfter()
          if (_error instanceof RPCError) {
            const error = _error
            logger.warn('Error making proof')

            if (genericService) {
              navigateAppend(
                {
                  name: 'profileGenericProofResult',
                  params: {
                    error: error.desc || 'Failed to verify proof',
                    genericParams: currentGenericParams,
                    username: currentUsername,
                  },
                },
                true
              )
            }

            if (error.code === T.RPCGen.StatusCode.scgeneric && reason === 'appLink') {
              navigateAppend({
                name: 'keybaseLinkError',
                params: {
                  error:
                    "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated.",
                },
              })
            }
          }
        } finally {
          addProofInProgress = false
          resetProofCallbacks()
          resetPgpCallbacks()
        }
      }
      ignorePromise(f())
    },
    defer: {
      onTracker2GetDetails: () => {
        throw new Error('onTracker2GetDetails not implemented')
      },
      onTracker2Load: () => {
        throw new Error('onTracker2Load not implemented')
      },
      onTracker2ShowUser: () => {
        throw new Error('onTracker2ShowUser not implemented')
      },
      onTracker2UpdateResult: () => {
        throw new Error('onTracker2UpdateResult not implemented')
      },
    },
    dynamic: {
      cancelAddProof: defaultCancelAddProof,
      cancelPgpGen: undefined,
      finishedWithKeyGen: undefined,
      submitUsername: undefined,
    },
    editAvatar: () => {
      throw new Error('This is overloaded by platform specific')
    },
    generatePgp: args => {
      const f = async () => {
        let canceled = false
        let pgpKeyString = 'Error getting public key...'
        const ids = [args.pgpEmail1, args.pgpEmail2, args.pgpEmail3].filter(Boolean).map(email => ({
          comment: '',
          email: email || '',
          username: args.pgpFullName || '',
        }))

        navigateAppend('profileGenerate')
        set(s => {
          s.dispatch.dynamic.cancelPgpGen = wrapErrors(() => {
            canceled = true
          })
        })

        try {
          await T.RPCGen.pgpPgpKeyGenDefaultRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
                if (canceled) {
                  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                } else {
                  pgpKeyString = key.key
                  response.result()
                }
              },
              'keybase.1.pgpUi.shouldPushPrivate': ({prompt}, response) => {
                navigateAppend({
                  name: 'profileFinished',
                  params: {pgpKeyString, promptShouldStoreKeyOnServer: prompt},
                })
                set(s => {
                  s.dispatch.dynamic.finishedWithKeyGen = wrapErrors((shouldStoreKeyOnServer: boolean) => {
                    set(s => {
                      s.dispatch.dynamic.finishedWithKeyGen = undefined
                    })
                    response.result(shouldStoreKeyOnServer)
                  })
                })
              },
            },
            incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
            params: {createUids: {ids, useDefault: false}},
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code !== T.RPCGen.StatusCode.scinputcanceled) {
            throw error
          }
        } finally {
          resetPgpCallbacks()
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: {
          ...s.dispatch,
          dynamic: {
            afterCheckProof: undefined,
            cancelAddProof: defaultCancelAddProof,
            cancelPgpGen: undefined,
            finishedWithKeyGen: undefined,
            submitUsername: undefined,
          },
        },
      }))
    },
    showUserProfile: username => {
      navToProfile(username)
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
