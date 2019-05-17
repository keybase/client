export type FeatureFlags = {
  admin: boolean,
  airdrop: boolean,
  chatIndexProfilingEnabled: boolean,
  dbCleanEnabled: boolean,
  enableDeleteFolder: boolean,
  foldersInProfileTab: boolean,
  kbfsOfflineMode: boolean,
  moveOrCopy: boolean,
  newTeamBuildingForChatAllowMakeTeam: boolean,
  outOfDateBanner: boolean,
  plansEnabled: boolean,
  proofProviders: boolean
};

declare var ff: FeatureFlags;
export default ff
