export type FeatureFlags = {
  admin: boolean
  airdrop: boolean
  audioAttachments: boolean
  chatIndexProfilingEnabled: boolean
  conflictResolution: boolean
  dbCleanEnabled: boolean
  fastAccountSwitch: boolean
  foldersInProfileTab: boolean
  kbfsOfflineMode: boolean
  moveOrCopy: boolean
  newTeamBuildingForChatAllowMakeTeam: boolean
  outOfDateBanner: boolean
  plansEnabled: boolean
  proofProviders: boolean
  stellarExternalPartners: boolean
  lagRadar: boolean
  userBlocking: boolean
}

declare const ff: FeatureFlags
export default ff
