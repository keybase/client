/* @flow */

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  mobileAppsExist: false,
  tabPeopleEnabled: false,
  tabFoldersEnabled: false,
  tabSettingsEnabled: __DEV__,
  tabProfileEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
