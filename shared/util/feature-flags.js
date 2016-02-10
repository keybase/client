/* @flow */

import getenv from 'getenv'

// To enable a feature, include it in the environment variable KEYBASE_FEATURES.
// For example, KEYBASE_FEATURES=tracker2,login,awesomefeature

type FeatureFlags = {
  tracker2: boolean,
  login: boolean
}

function loadFeatureFlags (): FeatureFlags {
  let features = getenv.array('KEYBASE_FEATURES', 'string', '')

  // For compatibility, this is deprecated
  if (getenv.boolish('KEYBASE_TRACKER_V2', false)) { features.push('tracker2') }
  if (getenv.boolish('KEYBASE_ALLOW_LOGIN', false)) { features.push('login') }

  return {
    tracker2: features.includes('tracker2'),
    login: features.includes('login')
  }
}

const ff = loadFeatureFlags()

console.log('Features', ff)

export default ff
