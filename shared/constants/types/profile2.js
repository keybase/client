// @flow strict
import * as I from 'immutable'
// import * as RPCTypes from './rpc-gen'

export type AssertionState = 'checking' | 'valid' | 'error' | 'warning' | 'revoked'
export type _AssertionMeta = {|
  color: 'blue' | 'red' | 'black' | 'green',
  label: string, // things like 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored', but can be anything
|}
type AssertionMeta = I.RecordOf<_AssertionMeta>

export type _Assertion = {
  metas: $ReadOnlyArray<AssertionMeta>,
  proofURL: string, // http://twitter.com/bob/post/1234
  site: string, // twitter
  siteIcon: string, // https://keybase.io/_/icons/twitter.png
  siteURL: string, // https://twitter.com/bob
  state: AssertionState,
  username: string, // bob
}
export type Assertion = I.RecordOf<_Assertion>

export type DetailsState = 'checking' | 'valid' | 'error' | 'needsUpgrade' | 'canceled'

export type _Details = {
  assertions: ?I.Map<string, Assertion>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  fullname: ?string,
  guiID: string,
  location: ?string,
  publishedTeams: ?$ReadOnlyArray<string>,
  reason: string,
  state: DetailsState,
  username: string,
}
export type Details = I.RecordOf<_Details>

export type _State = {
  usernameToDetails: I.Map<string, Details>,
}

export type State = I.RecordOf<_State>
