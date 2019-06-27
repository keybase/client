import {FeatureFlags} from '../util/feature-flags'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
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
  sbsContacts: true,
  stellarExternalPartners: false,
}

console.warn('feature flag mock in effect')

export default ff
