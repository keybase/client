import * as Z from '../util/zustand'
import * as LinksConstants from '../constants/deeplinks'
import openURL from '../util/open-url'
import {peopleTab} from './tabs'
import {RPCError} from '../util/errors'
import * as More from './types/more'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Validators from '../util/simple-validators'
import * as TrackerConstants from './tracker2'
import * as ConfigConstants from './config'
import {isMobile} from './platform'
import type * as RPCGen from './types/rpc-gen'
import type * as Types from './types/profile'

export const makeInitialState = (): Types.State => ({})

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
  result: RPCTypes.MessageTypes[T]['outParam'] extends undefined
    ? () => void
    : (res: RPCTypes.MessageTypes[T]['outParam']) => void
}

export const makeProveGenericParams = (): Types.ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

export const toProveGenericParams = (p: RPCGen.ProveParameters): Types.ProveGenericParams => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

export const waitingKey = 'profile:waiting'
export const uploadAvatarWaitingKey = 'profile:uploadAvatar'
export const blockUserWaitingKey = 'profile:blockUser'
export const wotAuthorWaitingKey = 'profile:wotAuthor'
export const AVATAR_SIZE = 128

type Store = {
  blockUserModal?: 'waiting' | {error: string}
  errorCode?: number
  errorText: string
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpErrorEmail1: boolean
  pgpErrorEmail2: boolean
  pgpErrorEmail3: boolean
  pgpErrorText: string
  pgpFullName: string
  pgpPublicKey: string
  platform?: More.PlatformsExpandedType
  platformGeneric?: string
  platformGenericChecking: boolean
  platformGenericParams?: Types.ProveGenericParams
  platformGenericURL?: string
  promptShouldStoreKeyOnServer: boolean
  proofFound: boolean
  proofStatus?: RPCTypes.ProofStatus
  proofText: string
  revokeError: string
  searchShowingSuggestions: boolean
  sigID?: RPCTypes.SigID
  username: string
  usernameValid: boolean
  wotAuthorError: string
}
const initialStore: Store = {
  blockUserModal: undefined,
  errorCode: undefined,
  errorText: '',
  pgpEmail1: '',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpErrorEmail1: false,
  pgpErrorEmail2: false,
  pgpErrorEmail3: false,
  pgpErrorText: '',
  pgpFullName: '',
  pgpPublicKey: '',
  platformGeneric: undefined,
  platformGenericChecking: false,
  promptShouldStoreKeyOnServer: false,
  proofFound: false,
  proofStatus: undefined,
  proofText: '',
  revokeError: '',
  searchShowingSuggestions: false,
  sigID: undefined,
  username: '',
  usernameValid: true,
  wotAuthorError: '',
}

type State = Store & {
  dispatch: {
    addProof: (platform: string, reason: 'appLink' | 'profile') => void
    backToProfile: () => void
    cancelAddProof: () => void
    cancelPgpGen: () => void
    checkProof: () => void
    clearPlatformGeneric: () => void
    editAvatar: () => void
    editProfile: (bio: string, fullname: string, location: string) => void
    finishRevoking: () => void
    finishedWithKeyGen: (shouldStoreKeyOnServer: boolean) => void
    generatePgp: () => void
    hideStellar: (h: boolean) => void
    recheckProof: (sigID: string) => void
    resetState: () => void
    setEditAvatar: (f: () => void) => void
    showUserProfile: (username: string) => void
    submitBlockUser: (username: string) => void
    submitBTCAddress: () => void
    submitRevokeProof: (proofId: string) => void
    submitUsername: () => void
    submitUnblockUser: (username: string, guiID: string) => void
    submitZcashAddress: () => void
    updatePgpInfo: (p: {
      pgpEmail1?: string
      pgpEmail2?: string
      pgpEmail3?: string
      pgpErrorText?: string
      pgpFullName?: string
    }) => void
    updateUsername: (username: string) => void
    uploadAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const getReduxStore = Z.getReduxStore()
  const clearErrors = (s: Store) => {
    s.errorCode = undefined
    s.errorText = ''
    s.platformGeneric = undefined
    s.platformGenericChecking = false
    s.platformGenericParams = undefined
    s.platformGenericURL = undefined
    s.username = ''
  }
  const updateUsername = (s: Store) => {
    let username = s.username
    let usernameValid = true

    switch (s.platform) {
      case 'http': // fallthrough
      case 'https':
        // Ensure that only the hostname is getting returned, with no
        // protocol, port, or path information
        username = username
          // Remove protocol information (if present)
          .replace(/^.*?:\/\//, '')
          // Remove port information (if present)
          .replace(/:.*/, '')
          // Remove path information (if present)
          .replace(/\/.*/, '')
        break
      case 'btc':
        {
          // A simple check, the server does a fuller check
          const legacyFormat = !!username.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
          const segwitFormat = !!username
            .toLowerCase()
            .match(/^(bc1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/)
          usernameValid = legacyFormat || segwitFormat
        }
        break
      default:
    }

    s.username = username
    s.usernameValid = usernameValid
  }

  const _cancelAddProof = () => {
    set(s => {
      clearErrors(s)
    })
  }

  let afterCheckProof = () => {}

  const submitCryptoAddress = (wantedFamily: 'btc' | 'zcash') => {
    set(s => {
      updateUsername(s)
    })
    const f = async () => {
      if (!get().usernameValid) {
        set(s => {
          s.errorText = 'Invalid address format'
          s.errorCode = 0
        })
        return
      }

      try {
        await RPCTypes.cryptocurrencyRegisterAddressRpcPromise(
          {address: get().username, force: true, wantedFamily},
          waitingKey
        )
        set(s => {
          s.proofFound = true
          s.proofStatus = RPCTypes.ProofStatus.ok
        })
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profileConfirmOrPending']}))
      } catch (_error) {
        if (_error instanceof RPCError) {
          const error = _error
          logger.warn('Error making proof')
          set(s => {
            s.errorText = error.desc
            s.errorCode = error.code
          })
        }
      }
    }
    Z.ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    addProof: (platform, reason) => {
      set(s => {
        const maybeNotGeneric = More.asPlatformsExpandedType(platform)
        clearErrors(s)
        s.platform = maybeNotGeneric ?? undefined
        s.platformGeneric = maybeNotGeneric ? undefined : platform
        updateUsername(s)
      })
      // only let one of these happen at a time
      let addProofInProgress = false
      const f = async () => {
        const service = More.asPlatformsExpandedType(platform)
        const genericService = service ? null : platform
        // Special cases
        switch (service) {
          case 'dnsOrGenericWebSite':
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profileProveWebsiteChoice']}))
            return
          case 'zcash': //  fallthrough
          case 'btc':
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']}))
            return
          case 'pgp':
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profilePgp']}))
            return
          default:
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
        set(s => {
          s.sigID = undefined
        })
        let canceled = false
        // Setup cancelling
        set(s => {
          s.dispatch.cancelAddProof = () => {
            _cancelAddProof()
            canceled = true
            if (_promptUsernameResponse) {
              _promptUsernameResponse.error(inputCancelError)
              _promptUsernameResponse = undefined
            }
            if (_outputInstructionsResponse) {
              _outputInstructionsResponse.error(inputCancelError)
              _outputInstructionsResponse = undefined
            }
            set(s => {
              s.dispatch.cancelAddProof = _cancelAddProof
            })
          }
        })

        afterCheckProof = () => {
          if (_outputInstructionsResponse) {
            _outputInstructionsResponse.result()
            _outputInstructionsResponse = undefined
          }
          afterCheckProof = () => {}
        }

        set(s => {
          s.dispatch.submitUsername = () => {
            set(s => {
              updateUsername(s)
            })
            if (_promptUsernameResponse) {
              set(s => {
                s.errorText = ''
                s.errorCode = undefined
              })
              _promptUsernameResponse.result(get().username)
              _promptUsernameResponse = undefined
            }
            // don't clear this as we can get multiple calls due to errors
          }
        })

        const loadAfter = Tracker2Gen.createLoad({
          assertion: ConfigConstants.useCurrentUserState.getState().username,
          guiID: TrackerConstants.generateGUIID(),
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
                  set(s => {
                    s.platformGenericChecking = true
                  })
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

                  _outputInstructionsResponse = response
                  // @ts-ignore propbably a real thing
                  if (service === 'dnsOrGenericWebSite') {
                    // We don't get this directly (yet) so we parse this out
                    try {
                      const match = instructions.data.match(/<url>(http[s]+):\/\//)
                      const protocol = match?.[1]
                      set(s => {
                        s.platform = protocol === 'https' ? 'https' : 'http'
                        updateUsername(s)
                      })
                    } catch (_) {
                      set(s => {
                        s.platform = 'http'
                        updateUsername(s)
                      })
                    }
                  }
                  if (service) {
                    set(s => {
                      s.proofText = proof
                    })
                    reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profilePostProof']}))
                  } else if (proof) {
                    set(s => {
                      s.platformGenericURL = proof
                    })
                    openURL(proof)
                    get().dispatch.checkProof()
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

                  _promptUsernameResponse = response
                  if (prevError) {
                    set(s => {
                      s.errorText = prevError.desc
                      s.errorCode = prevError.code
                    })
                  }
                  if (service) {
                    reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profileProveEnterUsername']}))
                  } else if (genericService && parameters) {
                    set(s => {
                      s.platformGenericParams = toProveGenericParams(parameters)
                    })
                    reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['profileGenericEnterUsername']}))
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
                promptPosted: !!genericService, // proof protocol extended slightly for generic proofs
                service: platform,
                username: '',
              },
              waitingKey,
            },
            Z.dummyListenerApi
          )
          set(s => {
            s.sigID = sigID
          })
          logger.info('Start Proof done: ', sigID)
          if (!genericService) {
            get().dispatch.checkProof()
          }
          reduxDispatch(loadAfter)
          if (genericService) {
            set(s => {
              s.platformGenericChecking = false
            })
          }
        } catch (_error) {
          if (_error instanceof RPCError) {
            const error = _error
            logger.warn('Error making proof')
            reduxDispatch(loadAfter)
            set(s => {
              s.errorText = error.desc
              s.errorCode = error.code
            })
            if (error.code === RPCTypes.StatusCode.scgeneric && reason === 'appLink') {
              LinksConstants.useState
                .getState()
                .dispatch.setLinkError(
                  "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated."
                )
              reduxDispatch(
                RouteTreeGen.createNavigateAppend({
                  path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
                })
              )
            }
          }
          if (genericService) {
            set(s => {
              s.platformGenericChecking = false
            })
          }
        }

        set(s => {
          s.dispatch.cancelAddProof = () => {}
          s.dispatch.submitUsername = () => {}
        })
        afterCheckProof = () => {}
        addProofInProgress = false
      }
      Z.ignorePromise(f())
    },
    backToProfile: () => {
      reduxDispatch(RouteTreeGen.createClearModals())
      get().dispatch.showUserProfile(ConfigConstants.useCurrentUserState.getState().username)
    },
    cancelAddProof: _cancelAddProof,
    cancelPgpGen: () => {
      // overloaded while generating pgp
    },
    checkProof: () => {
      set(s => {
        clearErrors(s)
      })
      const f = async () => {
        const sigID = get().sigID
        const isGeneric = !!get().platformGeneric
        if (!sigID) {
          return
        }
        try {
          const {found, status} = await RPCTypes.proveCheckProofRpcPromise({sigID}, waitingKey)
          // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
          if (!found && status >= RPCTypes.ProofStatus.baseHardError) {
            set(s => {
              s.errorText = "We couldn't find your proof. Please retry!"
            })
          } else {
            set(s => {
              s.errorText = ''
            })

            set(s => {
              s.proofFound = found
              s.proofStatus = status
            })
            if (!isGeneric) {
              reduxDispatch(
                RouteTreeGen.createNavigateAppend({
                  path: ['profileConfirmOrPending'],
                })
              )
            }
          }
        } catch (_) {
          logger.warn('Error getting proof update')
          set(s => {
            s.errorText = "We couldn't verify your proof. Please retry!"
          })
        }
      }
      Z.ignorePromise(f())
      afterCheckProof()
    },
    clearPlatformGeneric: () => {
      set(s => {
        clearErrors(s)
      })
    },
    editAvatar: () => {
      throw new Error('This is overloaded by platform specific')
    },
    editProfile: (bio, fullName, location) => {
      const f = async () => {
        await RPCTypes.userProfileEditRpcPromise({bio, fullName, location}, TrackerConstants.waitingKey)
        get().dispatch.showUserProfile(ConfigConstants.useCurrentUserState.getState().username)
      }
      Z.ignorePromise(f())
    },
    finishRevoking: () => {
      const username = ConfigConstants.useCurrentUserState.getState().username
      get().dispatch.showUserProfile(username)
      reduxDispatch(
        Tracker2Gen.createLoad({
          assertion: ConfigConstants.useCurrentUserState.getState().username,
          guiID: TrackerConstants.generateGUIID(),
          inTracker: false,
          reason: '',
        })
      )
      set(s => {
        s.revokeError = ''
      })
    },
    finishedWithKeyGen: _shouldStoreKeyOnServer => {
      // overloaded while generating pgp
    },
    generatePgp: () => {
      const f = async () => {
        let canceled = false
        const {pgpEmail1, pgpEmail2, pgpEmail3, pgpFullName} = get()
        const ids = [pgpEmail1, pgpEmail2, pgpEmail3].filter(Boolean).map(email => ({
          comment: '',
          email: email || '',
          username: pgpFullName || '',
        }))

        const username = ConfigConstants.useCurrentUserState.getState().username
        reduxDispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              peopleTab,
              {props: {username}, selected: 'profile'},
              'profilePgp',
              'profileProvideInfo',
              'profileGenerate',
            ],
          })
        )
        // We allow the UI to cancel this call. Just stash this intention and nav away and response with an error to the rpc
        set(s => {
          s.dispatch.cancelPgpGen = () => {
            canceled = true
          }
        })

        try {
          await RPCTypes.pgpPgpKeyGenDefaultRpcListener(
            {
              customResponseIncomingCallMap: {
                'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
                  if (canceled) {
                    response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                  } else {
                    response.result()
                    set(s => {
                      s.pgpPublicKey = key.key
                    })
                  }
                },
                'keybase.1.pgpUi.shouldPushPrivate': ({prompt}, response) => {
                  reduxDispatch(
                    RouteTreeGen.createNavigateAppend({
                      path: [
                        peopleTab,
                        {props: {username}, selected: 'profile'},
                        'profilePgp',
                        'profileProvideInfo',
                        'profileGenerate',
                        'profileFinished',
                      ],
                    })
                  )
                  set(s => {
                    s.promptShouldStoreKeyOnServer = prompt
                    s.dispatch.finishedWithKeyGen = (shouldStoreKeyOnServer: boolean) => {
                      response.result(shouldStoreKeyOnServer)
                      set(s => {
                        s.dispatch.finishedWithKeyGen = () => {}
                      })
                    }
                  })
                },
              },
              incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
              params: {createUids: {ids, useDefault: false}},
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // did we cancel?
          if (error.code !== RPCTypes.StatusCode.scinputcanceled) {
            throw error
          }
        }

        set(s => {
          s.dispatch.cancelPgpGen = () => {}
        })
      }
      Z.ignorePromise(f())
    },
    hideStellar: hidden => {
      const f = async () => {
        try {
          await RPCTypes.apiserverPostRpcPromise(
            {
              args: [{key: 'hidden', value: hidden ? '1' : '0'}],
              endpoint: 'stellar/hidden',
            },
            TrackerConstants.waitingKey
          )
        } catch (e) {
          logger.warn('Error setting Stellar hidden:', e)
        }
      }
      Z.ignorePromise(f())
    },
    recheckProof: sigID => {
      set(s => {
        s.errorCode = undefined
        s.errorText = ''
      })
      const f = async () => {
        await RPCTypes.proveCheckProofRpcPromise({sigID}, waitingKey)
        reduxDispatch(
          Tracker2Gen.createShowUser({
            asTracker: false,
            username: ConfigConstants.useCurrentUserState.getState().username,
          })
        )
      }
      Z.ignorePromise(f())
    },
    resetState: () => {
      // keep our injected callbacks
      set(s => ({...s, ...initialStore}))
    },
    setEditAvatar: (f: () => void) => {
      set(s => {
        s.dispatch.editAvatar = f
      })
    },
    showUserProfile: username => {
      if (isMobile) {
        reduxDispatch(RouteTreeGen.createClearModals())
      }
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profile'}]}))
    },
    submitBTCAddress: () => {
      submitCryptoAddress('btc')
    },
    submitBlockUser: username => {
      set(s => {
        s.blockUserModal = 'waiting'
      })
      const f = async () => {
        try {
          await RPCTypes.userBlockUserRpcPromise({username}, blockUserWaitingKey)
          set(s => {
            s.blockUserModal = undefined
          })
          reduxDispatch(
            Tracker2Gen.createLoad({
              assertion: username,
              guiID: TrackerConstants.generateGUIID(),
              inTracker: false,
              reason: '',
            })
          )
        } catch (_error) {
          if (!(_error instanceof RPCError)) {
            return
          }
          const error = _error
          logger.warn(`Error blocking user ${username}`, error)
          set(s => {
            s.blockUserModal = {error: error.desc || `There was an error blocking ${username}.`}
          })
        }
      }
      Z.ignorePromise(f())
    },
    submitRevokeProof: proofId => {
      const f = async () => {
        const you = TrackerConstants.getDetails(
          getReduxStore(),
          ConfigConstants.useCurrentUserState.getState().username
        )
        if (!you.assertions) return
        const proof = [...you.assertions.values()].find(a => a.sigID === proofId)
        if (!proof) return

        if (proof.type === 'pgp') {
          try {
            await RPCTypes.revokeRevokeKeyRpcPromise({keyID: proof.kid}, waitingKey)
          } catch (e) {
            logger.info('error in dropping pgp key', e)
            set(s => {
              s.revokeError = `Error in dropping Pgp Key: ${String(e)}`
            })
          }
        } else {
          try {
            await RPCTypes.revokeRevokeSigsRpcPromise({sigIDQueries: [proofId]}, waitingKey)
            get().dispatch.finishRevoking()
          } catch (error) {
            logger.warn(`Error when revoking proof ${proofId}`, error)
            set(s => {
              s.revokeError = 'There was an error revoking your proof. You can click the button to try again.'
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    submitUnblockUser: (username, guiID) => {
      const f = async () => {
        try {
          await RPCTypes.userUnblockUserRpcPromise({username}, blockUserWaitingKey)
          reduxDispatch(
            Tracker2Gen.createLoad({
              assertion: username,
              guiID: TrackerConstants.generateGUIID(),
              inTracker: false,
              reason: '',
            })
          )
        } catch (_error) {
          if (!(_error instanceof RPCError)) {
            return
          }
          const error = _error
          logger.warn(`Error unblocking user ${username}`, error)
          reduxDispatch(
            Tracker2Gen.createUpdateResult({
              guiID,
              reason: `Failed to unblock ${username}: ${error.desc}`,
              result: 'error',
            })
          )
        }
      }
      Z.ignorePromise(f())
    },
    submitUsername: () => {
      // overriden while making a proof
    },
    submitZcashAddress: () => {
      submitCryptoAddress('zcash')
    },
    updatePgpInfo: p => {
      set(s => {
        s.pgpEmail1 = p.pgpEmail1 ?? s.pgpEmail1
        s.pgpEmail2 = p.pgpEmail2 ?? s.pgpEmail2
        s.pgpEmail3 = p.pgpEmail3 ?? s.pgpEmail3
        const valid1 = Validators.isValidEmail(s.pgpEmail1)
        const valid2 = s.pgpEmail2 && Validators.isValidEmail(s.pgpEmail2)
        const valid3 = s.pgpEmail3 && Validators.isValidEmail(s.pgpEmail3)
        s.pgpErrorEmail1 = !!valid1
        s.pgpErrorEmail2 = !!valid2
        s.pgpErrorEmail3 = !!valid3
        s.pgpErrorText = Validators.isValidName(s.pgpFullName) || valid1 || valid2 || valid3
        s.pgpFullName = p.pgpFullName || s.pgpFullName
      })
    },
    updateUsername: username => {
      set(s => {
        s.username = username
        updateUsername(s)
      })
    },
    uploadAvatar: (filename, crop) => {
      const f = async () => {
        try {
          await RPCTypes.userUploadUserAvatarRpcPromise({crop, filename}, uploadAvatarWaitingKey)
          reduxDispatch(RouteTreeGen.createNavigateUp())
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // error displayed in component
          logger.warn(`Error uploading user avatar: ${error.message}`)
        }
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
