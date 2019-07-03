import * as I from 'immutable'
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

export type _ProveGenericParams = {
  logoBlack: SiteIconSet
  logoFull: SiteIconSet
  title: string
  subtext: string
  suffix: string
  buttonLabel: string
}
export type ProveGenericParams = I.RecordOf<_ProveGenericParams>

export type _State = {
  errorCode: number | null
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
  platform: PlatformsExpandedType | null
  platformGeneric: string | null
  platformGenericChecking: boolean
  platformGenericParams: ProveGenericParams | null
  platformGenericURL: string | null
  promptShouldStoreKeyOnServer: boolean
  proofFound: boolean
  proofStatus: RPCTypes.ProofStatus | null
  proofText: string
  revokeError: string
  blockUserModal: null | 'waiting' | {error: string}
  sigID: RPCTypes.SigID | null
  username: string
  usernameValid: boolean
  searchShowingSuggestions: boolean
}

export type State = I.RecordOf<_State>
