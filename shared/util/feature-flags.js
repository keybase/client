/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

const adminKey = 'admin'
const loginKey = 'login'
const mainWindowKey = 'mainWindow'
const mobileAppsExistKey = 'mobileAppsExist'

type FeatureFlags = {
  'admin': boolean,
  'login': boolean,
  'mainWindow': boolean,
  'mobileAppsExist': boolean
}

let features = getenv.array('KEYBASE_FEATURES', 'string', '')

const admin = features.includes(adminKey)
const login = features.includes(loginKey) || admin
const mainWindow = features.includes(mainWindowKey)
const mobileAppsExist = features.includes(mobileAppsExistKey)

const ff: FeatureFlags = {
  admin,
  login,
  mainWindow,
  mobileAppsExist
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
export {
  admin,
  login,
  mainWindow,
  mobileAppsExist
}
