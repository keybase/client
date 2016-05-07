/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

const adminKey = 'admin'
const mainWindowKey = 'mainWindow'
const mobileAppsExistKey = 'mobileAppsExist'

type FeatureFlags = {
  'admin': boolean,
  'mainWindow': boolean,
  'mobileAppsExist': boolean
}

let features = getenv.array('KEYBASE_FEATURES', 'string', '')

const admin = features.includes(adminKey)
const mainWindow = features.includes(mainWindowKey)
const mobileAppsExist = features.includes(mobileAppsExistKey)

const ff: FeatureFlags = {
  admin,
  mainWindow,
  mobileAppsExist
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
export {
  admin,
  mainWindow,
  mobileAppsExist
}
