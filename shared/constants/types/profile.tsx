import type * as RPCTypes from './rpc-gen'
import type {PlatformsExpandedType} from './more'
import type {SiteIconSet} from './tracker2'

export type ProveGenericParams = {
  logoBlack: SiteIconSet
  logoFull: SiteIconSet
  title: string
  subtext: string
  suffix: string
  buttonLabel: string
}

export type WotAuthorQuestion = 'question1' | 'question2'

export type State = {
  pgpErrorText: string
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpErrorEmail1: boolean
  pgpErrorEmail2: boolean
  pgpErrorEmail3: boolean
  pgpFullName: string
  pgpPublicKey: string
  platform?: PlatformsExpandedType
  platformGeneric?: string
  platformGenericChecking: boolean
  platformGenericParams?: ProveGenericParams
  platformGenericURL?: string
  promptShouldStoreKeyOnServer: boolean
  proofFound: boolean
  proofStatus?: RPCTypes.ProofStatus
  proofText: string
  revokeError: string
  blockUserModal?: 'waiting' | {error: string}
  sigID?: RPCTypes.SigID
  username: string
  usernameValid: boolean
  searchShowingSuggestions: boolean
  wotAuthorError: string
}
