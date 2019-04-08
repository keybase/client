import * as I from 'immutable'

export type _TeamShowcase = {
  description: string,
  isOpen: boolean,
  membersCount: number,
  name: string,
  publicAdmins: Array<string>
};
export type TeamShowcase = I.RecordOf<_TeamShowcase>;

export type AssertionState = "checking" | "valid" | "error" | "warning" | "revoked" | "suggestion";
export type AssertionColor = "blue" | "red" | "black" | "green" | "gray" | "yellow" | "orange";

export type _AssertionMeta = {
  color: AssertionColor,
  label: string
};
type AssertionMeta = I.RecordOf<_AssertionMeta>;

export type SiteIcon = {
  readonly path: string,
  readonly width: number
};
export type _Assertion = {
  assertionKey: string,
  color: AssertionColor,
  metas: ReadonlyArray<AssertionMeta>,
  priority: number,
  proofURL: string,
  sigID: string,
  siteIcon: ReadonlyArray<SiteIcon>,
  siteIconFull: ReadonlyArray<SiteIcon>,
  siteURL: string,
  state: AssertionState,
  timestamp: number,
  type: string,
  value: string
};
export type Assertion = I.RecordOf<_Assertion>;

export type DetailsState = "checking" | "valid" | "broken" | "needsUpgrade" | "error";

export type _Details = {
  assertions: I.Map<string, Assertion> | null,
  bio: string | null,
  followers: I.OrderedSet<string> | null,
  following: I.OrderedSet<string> | null,
  followersCount: number | null,
  followingCount: number | null,
  fullname: string | null,
  guiID: string,
  location: string | null,
  reason: string,
  registeredForAirdrop: boolean | null,
  showTracker: boolean,
  state: DetailsState,
  teamShowcase: I.List<TeamShowcase> | null,
  username: string
};
export type Details = I.RecordOf<_Details>;

export type _State = {
  usernameToDetails: I.Map<string, Details>,
  proofSuggestions: I.List<Assertion>
};

export type State = I.RecordOf<_State>;
