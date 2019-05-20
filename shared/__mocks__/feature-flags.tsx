if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff = {
  admin: false,
  airdrop: true,
  chatIndexProfilingEnabled: false,
  conflictResolution: false,
  dbCleanEnabled: false,
  foldersInProfileTab: true,
  kbfsOfflineMode: true,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  plansEnabled: false,
  proofProviders: true,
}

console.warn('feature flag mock in effect')

export default ff
