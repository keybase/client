// @flow
import {featureFlagsOverride} from '../local-debug.desktop'
import type {FeatureFlags} from './feature-flags'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

let features = [
  ...(featureFlagsOverride && featureFlagsOverride.split(',')),
  ...(process.env['KEYBASE_FEATURES'] || '').split(','),
]

const featureOn = (key: $Keys<FeatureFlags>) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  avatarUploadsEnabled: true,
  chatIndexProfilingEnabled: false,
  explodingMessagesEnabled: true,
  foldersInProfileTab: false,
  newTeamBuildingForChat: false,
  outOfDateBanner: false,
  plansEnabled: false,
  useSimpleMarkdown: false,
  walletsEnabled: false,
}

const inAdmin: {[key: $Keys<FeatureFlags>]: boolean} = {
  chatIndexProfilingEnabled: true,
  useSimpleMarkdown: true,
  walletsEnabled: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
