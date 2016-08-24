/* @flow */

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  mobileAppsExist: __DEV__,
  tabPeopleEnabled: __DEV__,
  tabFoldersEnabled: __DEV__,
  tabSettingsEnabled: __DEV__,
  tabProfileEnabled: __DEV__,
  searchEnabled: __DEV__,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
