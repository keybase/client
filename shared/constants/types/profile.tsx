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

export type State = {
  readonly errorCode?: number
  readonly errorText: string
  readonly pgpErrorText: string
  readonly pgpEmail1: string
  readonly pgpEmail2: string
  readonly pgpEmail3: string
  readonly pgpErrorEmail1: boolean
  readonly pgpErrorEmail2: boolean
  readonly pgpErrorEmail3: boolean
  readonly pgpFullName: string
  readonly pgpPublicKey: string
  readonly platform?: PlatformsExpandedType
  readonly platformGeneric?: string
  readonly platformGenericChecking: boolean
  readonly platformGenericParams?: ProveGenericParams
  readonly platformGenericURL?: string
  readonly promptShouldStoreKeyOnServer: boolean
  readonly proofFound: boolean
  readonly proofStatus?: RPCTypes.ProofStatus
  readonly proofText: string
  readonly revokeError: string
  readonly blockUserModal?: 'waiting' | {error: string}
  readonly sigID?: RPCTypes.SigID
  readonly username: string
  readonly usernameValid: boolean
  readonly searchShowingSuggestions: boolean
}
