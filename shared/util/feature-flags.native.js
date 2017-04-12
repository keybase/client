// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  chatAdminOnly: __DEV__,
  mobileAppsExist: true,
  plansEnabled: __DEV__,
  tabPeopleEnabled: __DEV__,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
