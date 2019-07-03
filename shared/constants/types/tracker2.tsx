import * as I from 'immutable'

export type _TeamShowcase = {
  description: string
  isOpen: boolean
  membersCount: number
  name: string
  publicAdmins: Array<string>
}
export type TeamShowcase = I.RecordOf<_TeamShowcase>

export type AssertionState = 'checking' | 'valid' | 'error' | 'warning' | 'revoked' | 'suggestion'
export type AssertionColor = 'blue' | 'red' | 'black' | 'green' | 'gray' | 'yellow' | 'orange'

export type _AssertionMeta = {
  color: AssertionColor
  label: string // things like 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored', but can be anything
}
type AssertionMeta = I.RecordOf<_AssertionMeta>

export type SiteIcon = {
  readonly path: string // https://keybase.io/_/icons/twitter.png,
  readonly width: number
}
export type SiteIconSet = ReadonlyArray<SiteIcon>
export type _Assertion = {
  assertionKey: string // twitter:bob,
  belowFold: boolean // suggestion in 'Other identities' dialog,
  color: AssertionColor
  kid: string // used to revoke pgp keys,
  metas: ReadonlyArray<AssertionMeta>
  pickerText: string // Text + subtext for 'Other identities' dialog,
  pickerSubtext: string
  pickerIcon: SiteIconSet // Icon for 'Other identities' dialog,
  priority: number // sort order,
  proofURL: string // http://twitter.com/bob/post/1234,
  sigID: string
  siteIcon: SiteIconSet
  siteIconFull: SiteIconSet // full color icon,
  siteURL: string // https://twitter.com/bob,
  state: AssertionState
  timestamp: number // can be 0,
  type: string // twitter,
  value: string // bob
}
export type Assertion = I.RecordOf<_Assertion>

export type DetailsState = 'checking' | 'valid' | 'broken' | 'needsUpgrade' | 'error' | 'notAUserYet'

export type _Details = {
  assertions: I.Map<string, Assertion> | null
  bio: string | null
  followers: I.OrderedSet<string> | null
  following: I.OrderedSet<string> | null
  followersCount: number | null
  followingCount: number | null
  fullname: string | null
  guiID: string
  location: string | null
  reason: string
  registeredForAirdrop: boolean | null
  showTracker: boolean
  state: DetailsState
  teamShowcase: I.List<TeamShowcase> | null
  username: string
  blocked: boolean
}
export type Details = I.RecordOf<_Details>

export type _State = {
  usernameToDetails: I.Map<string, Details>
  proofSuggestions: I.List<Assertion>
}

export type State = I.RecordOf<_State>
