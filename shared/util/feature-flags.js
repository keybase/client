/* @flow */

type FeatureFlag = {
  tracker: 'v1' | 'v2',
  allowLogin: true | false
}

const tracker = process.env.KEYBASE_TRACKER_V2 ? 'v2' : 'v1'
const allowLogin = process.env.KEYBASE_ALLOW_LOGIN ? true : false

const ff: FeatureFlag = {
  tracker,
  allowLogin
}

export default ff
export {tracker, allowLogin}
