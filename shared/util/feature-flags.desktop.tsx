import {featureFlagsOverride} from '../local-debug.desktop'
import {FeatureFlags} from './feature-flags'

const features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  connectThrashCheck: false,
  foldersInProfileTab: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  tabletSupport: true, // Whether tablet support is public. Changes some UI on non-tablets.
  teamInvites: false,
  teamsRedesign: false,
  videoChat: false,
  webOfTrust: false,
  whyDidYouRender: false,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {
  connectThrashCheck: true,
  moveOrCopy: true,
  tabletSupport: true,
  videoChat: true,
  webOfTrust: false,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
