// @flow
import type {FeatureFlags} from './feature-flags'
import {featureFlagsOverride} from '../local-debug.native'

let features = featureFlagsOverride && featureFlagsOverride.split(',')

const featureOn = (key: $Keys<FeatureFlags>) => features.includes(key)

const ff: FeatureFlags = {
  admin: __DEV__,
  avatarUploadsEnabled: true,
  explodingMessagesEnabled: true,
  fileWidgetEnabled: false,
  outOfDateBanner: false,
  plansEnabled: false,
  walletsEnabled: false,
  newTeamBuildingForChat: false,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || false
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
