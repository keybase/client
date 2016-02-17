/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

const tracker2Key = 'tracker2'
const loginKey = 'login'
const mobileAppsExistKey = 'mobileAppsExist'

type FeatureFlags = {
  'tracker2': boolean,
  'login': boolean,
  'mobileAppsExist': boolean
}

let features = getenv.array('KEYBASE_FEATURES', 'string', '')

// For compatibility, this is deprecated
if (getenv.boolish('KEYBASE_TRACKER_V2', false)) { features.push(tracker2Key) }
if (getenv.boolish('KEYBASE_ALLOW_LOGIN', false)) { features.push(loginKey) }
if (getenv.boolish('KEYBASE_MOBILE_APPS_EXIST', false)) { features.push(mobileAppsExistKey) }

const tracker2 = features.includes(tracker2Key)
const login = features.includes(loginKey)
const mobileAppsExist = features.includes(mobileAppsExistKey)

const ff: FeatureFlags = {
  tracker2,
  login,
  mobileAppsExist
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
export {
  tracker2,
  login,
  mobileAppsExist
}
