// @flow
import type {FeatureFlags} from './feature-flags'
import {featureFlagsOverride} from '../local-debug.native'

let features = featureFlagsOverride && featureFlagsOverride.split(',')

const featureOn = (key: $Keys<FeatureFlags>) => features.includes(key)

const ff: FeatureFlags = {
  admin: __DEV__,
  airdrop: false,
  chatIndexProfilingEnabled: false,
  dbCleanEnabled: false,
  foldersInProfileTab: false,
  identify3: true,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  plansEnabled: false,
  useNewRouter: true,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k) || ff[k] || false
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
