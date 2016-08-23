/* @flow */

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  mobileAppsExist: true,
  tabPeopleEnabled: true,
  tabFoldersEnabled: true,
  tabSettingsEnabled: __DEV__,
  tabProfileEnabled: true,
  searchEnabled: true,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
