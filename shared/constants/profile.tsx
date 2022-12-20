import type * as RPCGen from './types/rpc-gen'
import type * as Types from './types/profile'
import type {WebOfTrustVerificationType} from './types/more'

export const makeInitialState = (): Types.State => ({
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
  platformGenericChecking: false,
  promptShouldStoreKeyOnServer: false,
  proofFound: false,
  proofText: '',
  revokeError: '',
  searchShowingSuggestions: false,
  username: '',
  usernameValid: true,
  wotAuthorError: '',
})

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
export const maxProfileBioChars = 255
export const AVATAR_SIZE = 128
export const BACK_ZINDEX = 12
export const SEARCH_CONTAINER_ZINDEX = BACK_ZINDEX + 1
export const ADD_TO_TEAM_ZINDEX = SEARCH_CONTAINER_ZINDEX + 1
export const ROLE_PICKER_ZINDEX = ADD_TO_TEAM_ZINDEX + 1
export const EDIT_AVATAR_ZINDEX = SEARCH_CONTAINER_ZINDEX + 1

// In order of quality.
export const choosableWotVerificationTypes: WebOfTrustVerificationType[] = [
  'in_person',
  'video',
  'audio',
  'proofs',
  'other_chat',
  'familiar',
  'other',
]
