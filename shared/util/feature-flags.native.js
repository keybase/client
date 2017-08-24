// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  plansEnabled: false,
  recentFilesEnabled: false,
  tabPeopleEnabled: false,
  teamChatEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
