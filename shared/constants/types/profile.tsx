import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import {PlatformsExpandedType} from './more'

export type FriendshipsTab = 'Followers' | 'Following'

export type FriendshipUserInfo = {
  username: string
  uid: string
  fullname: string
  followsYou: boolean
  following: boolean
}

export type _State = {
  errorCode: number | null
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
  platform: PlatformsExpandedType | null
  proofFound: boolean
  proofStatus: RPCTypes.ProofStatus | null
  proofText: string
  revokeError: string
  sigID: RPCTypes.SigID | null
  username: string
  usernameValid: boolean
  searchShowingSuggestions: boolean
}

export type State = I.RecordOf<_State>
