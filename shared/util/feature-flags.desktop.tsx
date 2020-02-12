import {featureFlagsOverride} from '../local-debug.desktop'
import {FeatureFlags} from './feature-flags'

const features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  audioAttachments: false,
  botUI: true,
  chatIndexProfilingEnabled: false,
  connectThrashCheck: false,
  cryptoTab: true,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: false,
  lagRadar: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  openTeamSearch: false,
  outOfDateBanner: false,
  proofProviders: true,
  stellarExternalPartners: true,
  tabletSupport: false, // Whether tablet support is public. Changes some UI on non-tablets.
  teamInvites: false,
  teamsRedesign: true,
  userBlocking: true,
  webOfTrust: false,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {
  audioAttachments: false,
  botUI: true,
  chatIndexProfilingEnabled: true,
  connectThrashCheck: true,
  dbCleanEnabled: true,
  moveOrCopy: true,
  openTeamSearch: true,
  outOfDateBanner: true,
  proofProviders: true,
  tabletSupport: true,
  userBlocking: false,
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
