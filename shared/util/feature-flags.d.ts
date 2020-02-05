export type FeatureFlags = {
  admin: boolean
  audioAttachments: boolean
  botUI: boolean
  chatIndexProfilingEnabled: boolean
  connectThrashCheck: boolean
  cryptoTab: boolean
  dbCleanEnabled: boolean
  fastAccountSwitch: boolean
  foldersInProfileTab: boolean
  lagRadar: boolean
  moveOrCopy: boolean
  newTeamBuildingForChatAllowMakeTeam: boolean
  openTeamSearch: boolean
  outOfDateBanner: boolean
  proofProviders: boolean
  stellarExternalPartners: boolean
  teamInvites: boolean
  teamsRedesign: boolean
  userBlocking: boolean
  webOfTrust: boolean
}

declare const ff: FeatureFlags
export default ff
