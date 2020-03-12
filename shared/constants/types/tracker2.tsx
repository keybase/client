export type TeamShowcase = {
  description: string
  isOpen: boolean
  membersCount: number
  name: string
  publicAdmins: Array<string>
}

export type AssertionState = 'checking' | 'valid' | 'error' | 'warning' | 'revoked' | 'suggestion'
export type AssertionColor = 'blue' | 'red' | 'black' | 'green' | 'gray' | 'yellow' | 'orange'

export type AssertionMeta = {
  color: AssertionColor
  label: string // things like 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored', but can be anything
}

export type SiteIcon = {
  readonly path: string // https://keybase.io/_/icons/twitter.png,
  readonly width: number
}
export type SiteIconSet = Array<SiteIcon>
export type Assertion = {
  assertionKey: string // twitter:bob,
  belowFold: boolean // suggestion in 'Other identities' dialog,
  color: AssertionColor
  kid: string // used to revoke pgp keys,
  metas: ReadonlyArray<AssertionMeta>
  pickerText: string // Text + subtext for 'Other identities' dialog,
  pickerSubtext: string
  priority: number // sort order,
  proofURL: string // http://twitter.com/bob/post/1234,
  sigID: string
  siteIcon: SiteIconSet
  siteIconDarkmode: SiteIconSet
  siteIconFull: SiteIconSet // Full color icon for 'Other identities' dialog
  siteIconFullDarkmode: SiteIconSet
  siteURL: string // https://twitter.com/bob,
  state: AssertionState
  timestamp: number // can be 0,
  type: string // twitter,
  value: string // bob
}

export type DetailsState = 'checking' | 'valid' | 'broken' | 'needsUpgrade' | 'error' | 'notAUserYet'

export type Details = {
  assertions?: Map<string, Assertion>
  bio?: string
  blocked: boolean
  followers?: Set<string>
  followersCount?: number
  following?: Set<string>
  followingCount?: number
  fullname?: string
  guiID: string
  hidFromFollowers: boolean
  location?: string
  numAssertionsExpected?: number
  reason: string
  showTracker: boolean
  state: DetailsState
  stellarHidden?: boolean
  teamShowcase?: Array<TeamShowcase>
  username: string
  resetBrokeTrack: boolean
}

// Details for SBS profiles
export type NonUserDetails = {
  assertionKey: string
  assertionValue: string
  description: string
  bio?: string
  fullName?: string
  location?: string
  pictureUrl?: string
  formattedName?: string
  siteIcon: SiteIconSet
  siteIconDarkmode: SiteIconSet // full color icon,
  siteIconFull: SiteIconSet
  siteIconFullDarkmode: SiteIconSet
  siteURL: string // https://twitter.com/bob,
}

export type WebOfTrustEntry = {
  attestingUser: string
}

export type State = {
  readonly usernameToDetails: Map<string, Details>
  readonly usernameToNonUserDetails: Map<string, NonUserDetails>
  readonly proofSuggestions: ReadonlyArray<Assertion>
}
