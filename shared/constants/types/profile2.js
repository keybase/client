// @flow strict
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'

type AssertionState = 'checking' | 'valid' | 'error' | 'warning' | 'revoked'
type _AssertionMeta = {|
  label: string, // things like 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored', but can be anything
  color: 'blue' | 'red' | 'black' | 'green',
|}
type AssertionMeta = I.RecordOf<_AssertionMeta>

type _Assertion = {
  site: string, // twitter
  username: string, // bob
  siteURL: string, // https://twitter.com/bob
  siteIcon: string, // https://keybase.io/_/icons/twitter.png
  proofURL: string, // http://twitter.com/bob/post/1234
  state: AssertionState,
  metas: $ReadonlyArray<AssertionMeta>,
}
type Assertion = I.RecordOf<_Assertion>

type _Details = {
  followsYou: boolean,
  followThem: boolean,
  followersCount: number,
  followingCount: number,
  bio: string,
  location: string,
  publishedTeams: $ReadonlyArray<string>,
}
type Details = I.RecordOf<_Details>

export type _State = {
  usernameToDetails: I.Map<string, Details>,
  // TDOO make this one thing 'info' or split maps?
  usernameToSiteToAssertion: I.Map<string,
}

export type State = I.RecordOf<_State>
