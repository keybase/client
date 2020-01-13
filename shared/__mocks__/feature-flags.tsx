import {FeatureFlags} from '../util/feature-flags'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  audioAttachments: true,
  botUI: false,
  chatIndexProfilingEnabled: false,
  connectThrashCheck: true,
  cryptoTab: false,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: true,
  lagRadar: false,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  proofProviders: true,
  stellarExternalPartners: false,
  userBlocking: true,
}

console.warn('feature flag mock in effect')

export default ff
