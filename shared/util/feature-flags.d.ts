export type FeatureFlags = {
  admin: boolean
  audioAttachments: boolean
  botUI: boolean
  chatIndexProfilingEnabled: boolean
  connectThrashCheck: boolean
  dbCleanEnabled: boolean
  fastAccountSwitch: boolean
  foldersInProfileTab: boolean
  moveOrCopy: boolean
  newTeamBuildingForChatAllowMakeTeam: boolean
  outOfDateBanner: boolean
  proofProviders: boolean
  stellarExternalPartners: boolean
  lagRadar: boolean
  userBlocking: boolean
}

declare const ff: FeatureFlags
export default ff
