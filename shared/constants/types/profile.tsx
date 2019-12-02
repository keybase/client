import * as RPCTypes from './rpc-gen'
import {PlatformsExpandedType} from './more'
import {SiteIconSet} from './tracker2'

export type FriendshipsTab = 'Followers' | 'Following'

export type FriendshipUserInfo = {
  username: string
  uid: string
  fullname: string
  followsYou: boolean
  following: boolean
}

export type ProveGenericParams = Readonly<{
  logoBlack: SiteIconSet
  logoFull: SiteIconSet
  title: string
  subtext: string
  suffix: string
  buttonLabel: string
}>

export type State = Readonly<{
  errorCode?: number
  errorText: string
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
}>
