import * as Z from '../util/zustand'
import * as More from './types/more'
import * as RouteTreeGen from '../actions/route-tree-gen'
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Validators from '../util/simple-validators'
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
    resetState: 'default'
    revokeFinish: (error?: string) => void
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
    updateProofText: (proof) => void
    updateSigID: (sigID?: RPCTypes.SigID) => void
    updateUsername: (username: string) => void
    wotVouch: () => void
    wotVouchSetError: (error: string) => void
  }
}

// TODO
// [ProfileGen.updateErrorText]: (draftState, action) => {
//   draftState.errorCode = action.payload.errorCode
//   draftState.errorText = action.payload.errorText
// },
export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
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
      // todo
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
      // TODO
    },
    editProfile: (bio, fullname, location) => {
      // TODO
    },
    finishBlockUser: error => {
      set(s => {
        s.blockUserModal = error ? {error} : undefined
      })
    },
    finishRevoking: () => {
      // TODO
    },
    finishedWithKeyGen: shouldStoreKeyOnServer => {
      // TODO
    },
    generatePgp: () => {
      // TODO
    },
    hideStellar: h => {
      // TODO
    },
    proofParamsReceived: params => {
      set(s => {
        s.platformGenericParams = params
      })
    },
    recheckProof: sigID => {
      // TODO
      // draftState.errorCode = undefined
      // draftState.errorText = ''
    },
    resetState: 'default',
    revokeFinish: error => {
      set(s => {
        s.revokeError = error ?? ''
      })
    },
    showUserProfile: (username: string) => {
      // TODO
    },
    submitBTCAddress: () => {
      set(s => {
        updateUsername(s)
      })
    },
    submitBlockUser: (username: string) => {
      set(s => {
        s.blockUserModal = 'waiting'
      })
    },
    submitRevokeProof: (proofId: string) => {
      // todo
    },
    submitUsername: () => {
      // todo
    },
    submitUnblockUser: (username: string, guiID: string) => {
      // TODO
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
    updateUsername: (username: string) => {
      set(s => {
        s.username = username
        updateUsername(s)
      })
    },
    wotVouch: () => {
      set(s => {
        s.wotAuthorError = ''
      })
    },
    wotVouchSetError: error => {
      set(s => {
        s.wotAuthorError = error
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
