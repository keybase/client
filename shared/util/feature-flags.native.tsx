import {FeatureFlags} from './feature-flags'
import {featureFlagsOverride} from '../local-debug.native'

let features = featureFlagsOverride && featureFlagsOverride.split(',')

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: __DEV__,
  airdrop: true,
  audioAttachments: true,
  chatIndexProfilingEnabled: false,
  conflictResolution: true,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: false,
  kbfsOfflineMode: true,
  lagRadar: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  plansEnabled: false,
  proofProviders: true,
  stellarExternalPartners: true,
  userBlocking: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || false
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
