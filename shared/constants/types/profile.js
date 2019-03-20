// @flow strict
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import type {PlatformsExpandedType} from './more'
import type {SiteIconSet} from './tracker2'

export type FriendshipsTab = 'Followers' | 'Following'

export type FriendshipUserInfo = {|
  username: string,
  uid: string,
  fullname: string,
  followsYou: boolean,
  following: boolean,
|}

export type _ProveGenericParams = {|
  logoBlack: SiteIconSet,
  logoFull: SiteIconSet,
  title: string,
  subtext: string,
  suffix: string,
  buttonLabel: string,
|}
export type ProveGenericParams = I.RecordOf<_ProveGenericParams>

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
  platformGenericParams: ?ProveGenericParams,
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
