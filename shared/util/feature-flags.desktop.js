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
  chatIndexProfilingEnabled: false,
  foldersInProfileTab: false,
  identify3: false,
  moveOrCopy: false,
  newTeamBuildingForChat: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  plansEnabled: false,
  useNewRouter: false,
  walletsEnabled: true,
}

const inAdmin: {[key: $Keys<FeatureFlags>]: boolean} = {
  chatIndexProfilingEnabled: true,
  identify3: true,
  moveOrCopy: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
