export type FeatureFlags = {
  admin: boolean
  connectThrashCheck: boolean
  foldersInProfileTab: boolean
  inviteFriends: boolean
  tabletSupport: boolean
  moveOrCopy: boolean
  newTeamBuildingForChatAllowMakeTeam: boolean
  teamInvites: boolean
  teamsRedesign: boolean
  webOfTrust: boolean
  whyDidYouRender: boolean
}

declare const ff: FeatureFlags
export default ff
