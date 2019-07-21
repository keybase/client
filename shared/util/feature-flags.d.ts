export type FeatureFlags = {
  admin: boolean
  airdrop: boolean
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
  sbsContacts: boolean
  stellarExternalPartners: boolean
}

declare const ff: FeatureFlags
export default ff
