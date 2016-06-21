/* @flow */

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  mainWindow: false,
  mobileAppsExist: false,
  tabPeopleEnabled: false,
  tabFoldersEnabled: false,
  tabSettingsEnabled: __DEV__,
  tabProfileEnabled: false,
  searchEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
