/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

const tracker2Key = 'tracker2'
const loginKey = 'login'
const mobileAppsExistKey = 'mobileAppsExist'
const adminKey = 'admin'
const dz2Key = 'dz2'

type FeatureFlags = {
  'tracker2': boolean,
  'login': boolean,
  'mobileAppsExist': boolean,
  'admin': boolean,
  'dz2': boolean,
}

let features = getenv.array('KEYBASE_FEATURES', 'string', '')

const admin = features.includes(adminKey)
// admin implies dz2
const dz2 = features.includes(dz2Key) || admin
// dz2 implies tracker2
const login = features.includes(loginKey)
const tracker2 = features.includes(tracker2Key) || dz2
const mobileAppsExist = features.includes(mobileAppsExistKey)

const ff: FeatureFlags = {
  tracker2,
  login,
  mobileAppsExist,
  admin,
  dz2
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
export {
  tracker2,
  login,
  mobileAppsExist,
  admin,
  dz2
}
