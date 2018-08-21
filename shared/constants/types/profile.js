// @flow strict
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

export type PgpInfo = {|
  email1: ?string,
  email2: ?string,
  email3: ?string,
  errorText: ?string,
  fullName: ?string,
|}

export type PgpInfoError = {|
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
|}

export type State = {
  errorCode: ?number,
  errorText: ?string,
  pgpInfo: {...PgpInfo, ...PgpInfoError},
  pgpPublicKey: ?string,
  platform: ?PlatformsExpandedType,
  proofFound: boolean,
  proofStatus: ?RPCTypes.ProofStatus,
  proofText: ?string,
  revoke: {
    error: ?string,
    waiting: ?boolean,
  },
  sigID: ?RPCTypes.SigID,
  username: string,
  usernameValid: boolean,
  waiting: boolean,
  searchShowingSuggestions: boolean,
}
