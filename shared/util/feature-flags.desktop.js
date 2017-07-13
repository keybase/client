// @flow

import getenv from 'getenv'
import {featureFlagsOverride} from '../local-debug.desktop'
import type {FeatureFlags} from './feature-flags'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

let features =
  (featureFlagsOverride && featureFlagsOverride.split(',')) || getenv.array('KEYBASE_FEATURES', 'string', '')

const featureOn = (key: $Keys<FeatureFlags>) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  plansEnabled: false,
  recentFilesEnabled: false,
  searchv3Enabled: false,
  tabPeopleEnabled: true,
}

const inAdmin: {[key: $Keys<FeatureFlags>]: boolean} = {
  searchv3Enabled: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || (featureOn('admin') && inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
