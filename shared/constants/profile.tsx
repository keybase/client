import * as C from '.'
import * as T from './types'
import * as Validators from '@/util/simple-validators'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import openURL from '@/util/open-url'
import {RPCError} from '@/util/errors'
import {isMobile} from './platform'

type ProveGenericParams = {
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

export const waitingKey = 'profile:waiting'
export const uploadAvatarWaitingKey = 'profile:uploadAvatar'
export const blockUserWaitingKey = 'profile:blockUser'
export const wotAuthorWaitingKey = 'profile:wotAuthor'
export const AVATAR_SIZE = 128

type Store = T.Immutable<{
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
  platform?: T.More.PlatformsExpandedType
  platformGeneric?: string
  platformGenericChecking: boolean
  platformGenericParams?: ProveGenericParams
  platformGenericURL?: string
  promptShouldStoreKeyOnServer: boolean
  proofFound: boolean
  proofStatus?: T.RPCGen.ProofStatus
  proofText: string
  revokeError: string
  searchShowingSuggestions: boolean
  sigID?: T.RPCGen.SigID
  username: string
  usernameValid: boolean
  wotAuthorError: string
}>
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

interface State extends Store {
  dispatch: {
    dynamic: {
      afterCheckProof?: () => void
      cancelAddProof?: () => void
      cancelPgpGen?: () => void
      finishedWithKeyGen?: (shouldStoreKeyOnServer: boolean) => void
      submitUsername?: () => void
    }
    addProof: (platform: string, reason: 'appLink' | 'profile') => void
    backToProfile: () => void
    checkProof: () => void
    clearPlatformGeneric: () => void
    editAvatar: () => void
    editProfile: (bio: string, fullname: string, location: string) => void
    finishRevoking: () => void
    generatePgp: () => void
    hideStellar: (h: boolean) => void
    recheckProof: (sigID: string) => void
    resetState: () => void
    showUserProfile: (username: string) => void
    submitBlockUser: (username: string) => void
    submitBTCAddress: () => void
    submitRevokeProof: (proofId: string) => void
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
    uploadAvatar: (filename: string, crop?: T.RPCGen.ImageCropRect) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const clearErrors = (s: Z.WritableDraft<Store>) => {
    s.errorCode = undefined
    s.errorText = ''
    s.platformGeneric = undefined
    s.platformGenericChecking = false
    s.platformGenericParams = undefined
    s.platformGenericURL = undefined
    s.username = ''
  }
  const updateUsername = (s: Z.WritableDraft<Store>) => {
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
          const legacyFormat = username.search(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) !== -1
          const segwitFormat =
            username.toLowerCase().search(/^(bc1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/) !== -1
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

  const submitCryptoAddress = (wantedFamily: 'bitcoin' | 'zcash') => {
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
        await T.RPCGen.cryptocurrencyRegisterAddressRpcPromise(
          {address: get().username, force: true, wantedFamily},
          waitingKey
        )
        set(s => {
          s.proofFound = true
          s.proofStatus = T.RPCGen.ProofStatus.ok
        })
        C.useRouterState.getState().dispatch.navigateAppend('profileConfirmOrPending')
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
    C.ignorePromise(f())
  }

  // only let one of these happen at a time
  let addProofInProgress = false

  const dispatch: State['dispatch'] = {
    addProof: (platform, reason) => {
      if (addProofInProgress) {
        logger.warn('addProof while one in progress')
        return
      }
      set(s => {
        const maybeNotGeneric = T.More.asPlatformsExpandedType(platform)
        clearErrors(s)
        s.platform = maybeNotGeneric ?? undefined
        s.platformGeneric = maybeNotGeneric ? undefined : platform
        updateUsername(s)
      })
      const f = async () => {
        const service = T.More.asPlatformsExpandedType(platform)
        const genericService = service ? null : platform
        // Special cases
        switch (service) {
          case 'dnsOrGenericWebSite':
            C.useRouterState.getState().dispatch.navigateAppend('profileProveWebsiteChoice')
            return
          case 'zcash': //  fallthrough
          case 'btc':
            C.useRouterState.getState().dispatch.navigateAppend('profileProveEnterUsername')
            return
          case 'pgp':
            C.useRouterState.getState().dispatch.navigateAppend('profilePgp')
            return
          default:
        }

        addProofInProgress = true

        const inputCancelError = {
          code: T.RPCGen.StatusCode.scinputcanceled,
          desc: 'Cancel Add Proof',
        }
        set(s => {
          s.sigID = undefined
        })
        let canceled = false

        const loadAfter = () =>
          C.useTrackerState.getState().dispatch.load({
            assertion: C.useCurrentUserState.getState().username,
            guiID: C.Tracker.generateGUIID(),
            inTracker: false,
            reason: '',
          })
        try {
          const {sigID} = await T.RPCGen.proveStartProofRpcListener({
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
              'keybase.1.proveUi.outputInstructions': ({proof}, response) => {
                if (canceled) {
                  response.error(inputCancelError)
                  return
                }
                set(s => {
                  s.dispatch.dynamic.afterCheckProof = C.wrapErrors(() => {
                    set(s => {
                      s.dispatch.dynamic.afterCheckProof = undefined
                    })
                    response.result()
                  })
                  s.dispatch.dynamic.cancelAddProof = C.wrapErrors(() => {
                    set(s => {
                      s.dispatch.dynamic.cancelAddProof = _cancelAddProof
                    })
                    _cancelAddProof()
                    canceled = true
                    response.error(inputCancelError)
                  })
                })
                if (service) {
                  set(s => {
                    s.proofText = proof
                  })
                  C.useRouterState.getState().dispatch.navigateAppend('profilePostProof')
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
                const clear = () => {
                  set(s => {
                    s.errorText = ''
                    s.errorCode = undefined
                  })
                }
                set(s => {
                  s.dispatch.dynamic.cancelAddProof = C.wrapErrors(() => {
                    clear()
                    set(s => {
                      s.dispatch.dynamic.cancelAddProof = _cancelAddProof
                    })
                    _cancelAddProof()
                    canceled = true
                    response.error(inputCancelError)
                  })
                  s.dispatch.dynamic.submitUsername = C.wrapErrors(() => {
                    clear()
                    set(s => {
                      updateUsername(s)
                      s.dispatch.dynamic.submitUsername = undefined
                    })
                    response.result(get().username)
                  })
                })
                if (prevError) {
                  set(s => {
                    s.errorText = prevError.desc
                    s.errorCode = prevError.code
                  })
                }
                if (service) {
                  C.useRouterState.getState().dispatch.navigateAppend('profileProveEnterUsername')
                } else if (genericService && parameters) {
                  set(s => {
                    s.platformGenericParams = T.castDraft(toProveGenericParams(parameters))
                  })
                  C.useRouterState.getState().dispatch.navigateAppend('profileGenericEnterUsername')
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
          })
          set(s => {
            s.sigID = sigID
          })
          logger.info('Start Proof done: ', sigID)
          if (!genericService) {
            get().dispatch.checkProof()
          }
          loadAfter()
          if (genericService) {
            set(s => {
              s.platformGenericChecking = false
            })
          }
        } catch (_error) {
          if (_error instanceof RPCError) {
            const error = _error
            logger.warn('Error making proof')
            loadAfter()
            set(s => {
              s.errorText = error.desc
              s.errorCode = error.code
            })
            if (error.code === T.RPCGen.StatusCode.scgeneric && reason === 'appLink') {
              C.useDeepLinksState
                .getState()
                .dispatch.setLinkError(
                  "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated."
                )
              C.useRouterState.getState().dispatch.navigateAppend('keybaseLinkError')
            }
          }
          if (genericService) {
            set(s => {
              s.platformGenericChecking = false
            })
          }
        } finally {
          addProofInProgress = false
          set(s => {
            s.dispatch.dynamic.cancelAddProof = _cancelAddProof
            s.dispatch.dynamic.afterCheckProof = undefined
            s.dispatch.dynamic.cancelPgpGen = undefined
            s.dispatch.dynamic.submitUsername = undefined
          })
        }
      }
      C.ignorePromise(f())
    },
    backToProfile: () => {
      C.useRouterState.getState().dispatch.clearModals()
      get().dispatch.showUserProfile(C.useCurrentUserState.getState().username)
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
          const {found, status} = await T.RPCGen.proveCheckProofRpcPromise({sigID}, waitingKey)
          // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
          if (!found && status >= T.RPCGen.ProofStatus.baseHardError) {
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
              C.useRouterState.getState().dispatch.navigateAppend('profileConfirmOrPending')
            }
          }
        } catch {
          logger.warn('Error getting proof update')
          set(s => {
            s.errorText = "We couldn't verify your proof. Please retry!"
          })
        }
      }
      C.ignorePromise(f())
      get().dispatch.dynamic.afterCheckProof?.()
    },
    clearPlatformGeneric: () => {
      set(s => {
        clearErrors(s)
      })
    },
    dynamic: {
      cancelAddProof: _cancelAddProof,
      cancelPgpGen: undefined,
      finishedWithKeyGen: undefined,
    },
    editAvatar: () => {
      throw new Error('This is overloaded by platform specific')
    },
    editProfile: (bio, fullName, location) => {
      const f = async () => {
        await T.RPCGen.userProfileEditRpcPromise({bio, fullName, location}, C.Tracker.waitingKey)
        get().dispatch.showUserProfile(C.useCurrentUserState.getState().username)
      }
      C.ignorePromise(f())
    },
    finishRevoking: () => {
      const username = C.useCurrentUserState.getState().username
      get().dispatch.showUserProfile(username)
      C.useTrackerState.getState().dispatch.load({
        assertion: C.useCurrentUserState.getState().username,
        guiID: C.Tracker.generateGUIID(),
        inTracker: false,
        reason: '',
      })
      set(s => {
        s.revokeError = ''
      })
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

        C.useRouterState.getState().dispatch.navigateAppend('profileGenerate')
        // We allow the UI to cancel this call. Just stash this intention and nav away and response with an error to the rpc
        set(s => {
          s.dispatch.dynamic.cancelPgpGen = C.wrapErrors(() => {
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
                  response.result()
                  set(s => {
                    s.pgpPublicKey = key.key
                  })
                }
              },
              'keybase.1.pgpUi.shouldPushPrivate': ({prompt}, response) => {
                C.useRouterState.getState().dispatch.navigateAppend('profileFinished')
                set(s => {
                  s.promptShouldStoreKeyOnServer = prompt
                  s.dispatch.dynamic.finishedWithKeyGen = C.wrapErrors((shouldStoreKeyOnServer: boolean) => {
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
          // did we cancel?
          if (error.code !== T.RPCGen.StatusCode.scinputcanceled) {
            throw error
          }
        }
        set(s => {
          s.dispatch.dynamic.cancelPgpGen = undefined
          s.dispatch.dynamic.finishedWithKeyGen = undefined
        })
      }
      C.ignorePromise(f())
    },
    hideStellar: hidden => {
      const f = async () => {
        try {
          await T.RPCGen.apiserverPostRpcPromise(
            {
              args: [{key: 'hidden', value: hidden ? '1' : '0'}],
              endpoint: 'stellar/hidden',
            },
            C.Tracker.waitingKey
          )
        } catch (e) {
          logger.warn('Error setting Stellar hidden:', e)
        }
      }
      C.ignorePromise(f())
    },
    recheckProof: sigID => {
      set(s => {
        s.errorCode = undefined
        s.errorText = ''
      })
      const f = async () => {
        await T.RPCGen.proveCheckProofRpcPromise({sigID}, waitingKey)
        C.useTrackerState.getState().dispatch.showUser(C.useCurrentUserState.getState().username, false)
      }
      C.ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
    showUserProfile: username => {
      if (isMobile) {
        C.useRouterState.getState().dispatch.clearModals()
      }
      C.useRouterState.getState().dispatch.navigateAppend({props: {username}, selected: 'profile'})
    },
    submitBTCAddress: () => {
      submitCryptoAddress('bitcoin')
    },
    submitBlockUser: username => {
      set(s => {
        s.blockUserModal = 'waiting'
      })
      const f = async () => {
        try {
          await T.RPCGen.userBlockUserRpcPromise({username}, blockUserWaitingKey)
          set(s => {
            s.blockUserModal = undefined
          })
          C.useTrackerState.getState().dispatch.load({
            assertion: username,
            guiID: C.Tracker.generateGUIID(),
            inTracker: false,
            reason: '',
          })
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
      C.ignorePromise(f())
    },
    submitRevokeProof: proofId => {
      const f = async () => {
        const you = C.Tracker.getDetails(
          C.useTrackerState.getState(),
          C.useCurrentUserState.getState().username
        )
        if (!you.assertions) return
        const proof = [...you.assertions.values()].find(a => a.sigID === proofId)
        if (!proof) return

        if (proof.type === 'pgp') {
          try {
            await T.RPCGen.revokeRevokeKeyRpcPromise({keyID: proof.kid}, waitingKey)
          } catch (e) {
            logger.info('error in dropping pgp key', e)
            set(s => {
              s.revokeError = `Error in dropping Pgp Key: ${String(e)}`
            })
          }
        } else {
          try {
            await T.RPCGen.revokeRevokeSigsRpcPromise({sigIDQueries: [proofId]}, waitingKey)
            get().dispatch.finishRevoking()
          } catch (error) {
            logger.warn(`Error when revoking proof ${proofId}`, error)
            set(s => {
              s.revokeError = 'There was an error revoking your proof. You can click the button to try again.'
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    submitUnblockUser: (username, guiID) => {
      const f = async () => {
        try {
          await T.RPCGen.userUnblockUserRpcPromise({username}, blockUserWaitingKey)
          C.useTrackerState.getState().dispatch.load({
            assertion: username,
            guiID: C.Tracker.generateGUIID(),
            inTracker: false,
            reason: '',
          })
        } catch (_error) {
          if (!(_error instanceof RPCError)) {
            return
          }
          const error = _error
          logger.warn(`Error unblocking user ${username}`, error)
          C.useTrackerState
            .getState()
            .dispatch.updateResult(guiID, 'error', `Failed to unblock ${username}: ${error.desc}`)
        }
      }
      C.ignorePromise(f())
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
          await T.RPCGen.userUploadUserAvatarRpcPromise({crop, filename}, uploadAvatarWaitingKey)
          C.useRouterState.getState().dispatch.navigateUp()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // error displayed in component
          logger.warn(`Error uploading user avatar: ${error.message}`)
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
