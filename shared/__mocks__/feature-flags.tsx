import {FeatureFlags} from '../util/feature-flags'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  airdrop: true,
  audioAttachments: true,
  chatIndexProfilingEnabled: false,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: true,
  lagRadar: false,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  plansEnabled: false,
  proofProviders: true,
  stellarExternalPartners: false,
  userBlocking: true,
}

console.warn('feature flag mock in effect')

export default ff
