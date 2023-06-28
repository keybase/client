import * as Z from '../util/zustand'
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
    cleanupUsername: () => void
    clearPlatformGeneric: () => void
    editAvatar: () => void
    editProfile: (bio: string, fullname: string, location: string) => void
    finishBlockUser: (error?: string) => void
    finishRevoking: () => void
    finishedWithKeyGen: (shouldStoreKeyOnServer: boolean) => void
    generatePgp: () => void
    hideStellar: (h: boolean) => void
    proofParamsReceived: (params: Types.ProveGenericParams) => void
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
    updatePgpPublicKey: (publicKey: string) => void
    updatePlatform: (platform: More.PlatformsExpandedType) => void
    updatePlatformGenericChecking: (checking: boolean) => void
    updatePlatformGenericURL: (url: string) => void
    updatePromptShouldStoreKeyOnServer: (promptShouldStoreKeyOnServer: boolean) => void
    updateProofStatus: (found: boolean, status: RPCTypes.ProofStatus) => void
    updateProofText: (proof: string) => void
    updateSigID: (sigID?: RPCTypes.SigID) => void
    updateUsername: (username: string) => void
    uploadAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) => void
    // wotVouch: () => void
    // wotVouchSetError: (error: string) => void
  }
}

// TODO
// [ProfileGen.updateErrorText]: (draftState, action) => {
//   draftState.errorCode = action.payload.errorCode
//   draftState.errorText = action.payload.errorText
// },
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
    }

    s.username = username
    s.usernameValid = usernameValid
  }

  const dispatch: State['dispatch'] = {
    addProof: platform => {
      set(s => {
        const maybeNotGeneric = More.asPlatformsExpandedType(platform)
        clearErrors(s)
        s.platform = maybeNotGeneric ?? undefined
        s.platformGeneric = maybeNotGeneric ? undefined : platform
        updateUsername(s)
      })
    },
    backToProfile: () => {
      reduxDispatch(RouteTreeGen.createClearModals())
      get().dispatch.showUserProfile(ConfigConstants.useCurrentUserState.getState().username)
    },
    cancelAddProof: () => {
      set(s => {
        clearErrors(s)
      })
    },
    cancelPgpGen: () => {
      // todo
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
            // TODO?? / replace
            // reduxDispatch ( ProfileGen.createUpdateProofStatus({found, status}))
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
    },
    cleanupUsername: () => {
      set(s => {
        updateUsername(s)
      })
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
    finishBlockUser: error => {
      set(s => {
        s.blockUserModal = error ? {error} : undefined
      })
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
      // TODO
    },
    generatePgp: () => {
      // TODO
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
      // TODO
    },
    proofParamsReceived: params => {
      set(s => {
        s.platformGenericParams = params
      })
    },
    recheckProof: _sigID => {
      // TODO
      // draftState.errorCode = undefined
      // draftState.errorText = ''
    },
    resetState: () => {
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
      set(s => {
        updateUsername(s)
      })
    },
    submitBlockUser: _username => {
      // TODO
      set(s => {
        s.blockUserModal = 'waiting'
      })
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
    submitUnblockUser: (_username, _guiID) => {
      // TODO
    },
    submitUsername: () => {
      // todo
    },
    submitZcashAddress: () => {
      set(s => {
        updateUsername(s)
      })
    },
    updatePgpInfo: p => {
      set(s => {
        s.pgpEmail1 = p.pgpEmail1 || s.pgpEmail1
        s.pgpEmail2 = p.pgpEmail2 || s.pgpEmail2
        s.pgpEmail3 = p.pgpEmail3 || s.pgpEmail3
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
    updatePgpPublicKey: publicKey => {
      set(s => {
        s.pgpPublicKey = publicKey
      })
    },
    updatePlatform: platform => {
      set(s => {
        s.platform = platform
        updateUsername(s)
      })
    },
    updatePlatformGenericChecking: checking => {
      set(s => {
        s.platformGenericChecking = checking
      })
    },
    updatePlatformGenericURL: url => {
      set(s => {
        s.platformGenericURL = url
      })
    },
    updatePromptShouldStoreKeyOnServer: promptShouldStoreKeyOnServer => {
      set(s => {
        s.promptShouldStoreKeyOnServer = promptShouldStoreKeyOnServer
      })
    },
    updateProofStatus: (found, status) => {
      set(s => {
        s.proofFound = found
        s.proofStatus = status
      })
    },
    updateProofText: proof => {
      set(s => {
        s.proofText = proof
      })
    },
    updateSigID: sigID => {
      set(s => {
        s.sigID = sigID
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
    // wotVouch: () => {
    //   set(s => {
    //     s.wotAuthorError = ''
    //   })
    // },
    // wotVouchSetError: error => {
    //   set(s => {
    //     s.wotAuthorError = error
    //   })
    // },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
