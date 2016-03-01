/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

const tracker2Key = 'tracker2'
const loginKey = 'login'
const mobileAppsExistKey = 'mobileAppsExist'
const adminKey = 'admin'

type FeatureFlags = {
  'tracker2': boolean,
  'login': boolean,
  'mobileAppsExist': boolean,
  'admin': boolean
}

let features = getenv.array('KEYBASE_FEATURES', 'string', '')

const tracker2 = features.includes(tracker2Key) || features.includes(adminKey)
const login = features.includes(loginKey)
const mobileAppsExist = features.includes(mobileAppsExistKey)
const admin = features.include(adminKey)

const ff: FeatureFlags = {
  tracker2,
  login,
  mobileAppsExist,
  admin
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
export {
  tracker2,
  login,
  mobileAppsExist,
  admin
}
