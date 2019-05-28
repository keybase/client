export type FeatureFlags = {
  admin: boolean
  airdrop: boolean
  chatIndexProfilingEnabled: boolean
  dbCleanEnabled: boolean
  foldersInProfileTab: boolean
  kbfsOfflineMode: boolean
  moveOrCopy: boolean
  newTeamBuildingForChatAllowMakeTeam: boolean
  outOfDateBanner: boolean
  plansEnabled: boolean
  proofProviders: boolean
}

declare const ff: FeatureFlags
export default ff
