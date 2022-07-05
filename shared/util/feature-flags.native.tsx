import {FeatureFlags} from './feature-flags'
import {featureFlagsOverride} from '../local-debug.native'

const features = featureFlagsOverride && featureFlagsOverride.split(',')

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: __DEV__,
  connectThrashCheck: false,
  foldersInProfileTab: false,
  inviteFriends: true,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  tabletSupport: true,
  teamInvites: false,
  teamsRedesign: true,
  webOfTrust: false,
  whyDidYouRender: false,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || false
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
