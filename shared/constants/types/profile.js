// @flow strict
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import type {PlatformsExpandedType} from './more'

export type FriendshipsTab = 'Followers' | 'Following'

export type FriendshipUserInfo = {|
  username: string,
  uid: string,
  fullname: string,
  followsYou: boolean,
  following: boolean,
|}

export type _State = {
  errorCode: ?number,
  errorText: string,
  pgpErrorText: string,
  pgpEmail1: string,
  pgpEmail2: string,
  pgpEmail3: string,
  pgpErrorEmail1: boolean,
  pgpErrorEmail2: boolean,
  pgpErrorEmail3: boolean,
  pgpErrorText: string,
  pgpFullName: string,
  pgpPublicKey: string,
  platform: ?PlatformsExpandedType,
  platformGeneric: ?string,
  proofFound: boolean,
  proofStatus: ?RPCTypes.ProofStatus,
  proofText: string,
  revokeError: string,
  sigID: ?RPCTypes.SigID,
  username: string,
  usernameValid: boolean,
  searchShowingSuggestions: boolean,
}

export type State = I.RecordOf<_State>
