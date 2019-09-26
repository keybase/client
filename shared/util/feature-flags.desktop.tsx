import {featureFlagsOverride} from '../local-debug.desktop'
import {FeatureFlags} from './feature-flags'

if (process.env['KEYBASE_FEATURES']) {
  console.error('KEYBASE_FEATURES is no longer supported. Edit the "*.app.debug" json file instead')
}

let features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  airdrop: true,
  chatIndexProfilingEnabled: false,
  conflictResolution: false,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: false,
  kbfsOfflineMode: false,
  lagRadar: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  plansEnabled: false,
  proofProviders: true,
  resetPipeline: true,
  stellarExternalPartners: true,
  whatsNew: false,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {
  chatIndexProfilingEnabled: true,
  dbCleanEnabled: true,
  kbfsOfflineMode: true,
  moveOrCopy: true,
  outOfDateBanner: true,
  proofProviders: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
