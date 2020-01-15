import {featureFlagsOverride} from '../local-debug.desktop'
import {FeatureFlags} from './feature-flags'

const features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  audioAttachments: false,
  botUI: false,
  chatIndexProfilingEnabled: false,
  connectThrashCheck: false,
  cryptoTab: false,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: false,
  lagRadar: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  proofProviders: true,
  stellarExternalPartners: true,
  userBlocking: true,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {
  audioAttachments: false,
  botUI: true,
  chatIndexProfilingEnabled: true,
  connectThrashCheck: true,
  cryptoTab: true,
  dbCleanEnabled: true,
  moveOrCopy: true,
  outOfDateBanner: true,
  proofProviders: true,
  userBlocking: false,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
