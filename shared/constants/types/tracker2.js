// @flow strict
import * as I from 'immutable'

export type _TeamShowcase = {|
  description: string,
  isOpen: boolean,
  membersCount: number,
  name: string,
  publicAdmins: Array<string>,
|}
export type TeamShowcase = I.RecordOf<_TeamShowcase>

export type AssertionState = 'checking' | 'valid' | 'error' | 'warning' | 'revoked' | 'suggestion'
export type AssertionColor = 'blue' | 'red' | 'black' | 'green' | 'gray' | 'yellow' | 'orange'

export type _AssertionMeta = {|
  color: AssertionColor,
  label: string, // things like 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored', but can be anything
|}
type AssertionMeta = I.RecordOf<_AssertionMeta>

export type _Assertion = {
  assertionKey: string, // twitter:bob
  color: AssertionColor,
  metas: $ReadOnlyArray<AssertionMeta>,
  proofURL: string, // http://twitter.com/bob/post/1234
  sigID: string,
  siteIcon: string, // https://keybase.io/_/icons/twitter.png
  siteURL: string, // https://twitter.com/bob
  state: AssertionState,
  type: string, // twitter
  value: string, // bob
}
export type Assertion = I.RecordOf<_Assertion>

export type DetailsState = 'checking' | 'valid' | 'broken' | 'needsUpgrade' | 'error'

export type _Details = {
  assertions: ?I.Map<string, Assertion>,
  bio: ?string,
  followers: ?I.OrderedSet<string>,
  following: ?I.OrderedSet<string>,
  followersCount: ?number,
  followingCount: ?number,
  fullname: ?string,
  guiID: string,
  location: ?string,
  reason: string,
  showTracker: boolean,
  state: DetailsState,
  teamShowcase: ?I.List<TeamShowcase>,
  username: string,
}
export type Details = I.RecordOf<_Details>

export type _State = {
  usernameToDetails: I.Map<string, Details>,
  proofSuggestions: I.List<Assertion>,
}

export type State = I.RecordOf<_State>
