export type FeatureFlags = {
  admin: boolean,
  airdrop: boolean,
  chatIndexProfilingEnabled: boolean,
  dbCleanEnabled: boolean,
  foldersInProfileTab: boolean,
  moveOrCopy: boolean,
  newTeamBuildingForChatAllowMakeTeam: boolean,
  outOfDateBanner: boolean,
  plansEnabled: boolean,
  proofProviders: boolean,
  useNewRouter: boolean
};

declare var ff: FeatureFlags
export default ff
