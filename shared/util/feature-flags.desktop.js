// @flow
import {featureFlagsOverride} from '../local-debug.desktop'
import type {FeatureFlags} from './feature-flags'

if (process.env['KEYBASE_FEATURES']) {
  console.error('KEYBASE_FEATURES is no longer supported edit the json file instead')
}

let features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: $Keys<FeatureFlags>) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  airdrop: false,
  chatIndexProfilingEnabled: false,
  dbCleanEnabled: false,
  foldersInProfileTab: false,
  identify3: true,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  plansEnabled: false,
  proofProviders: __DEV__,
  useNewRouter: false,
}

const inAdmin: {[key: $Keys<FeatureFlags>]: boolean} = {
  chatIndexProfilingEnabled: true,
  dbCleanEnabled: true,
  moveOrCopy: true,
  outOfDateBanner: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
