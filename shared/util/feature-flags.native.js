// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  plansEnabled: false,
  recentFilesEnabled: false,
  searchv3Enabled: true,
  tabPeopleEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
