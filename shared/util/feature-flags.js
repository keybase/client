/* @flow */

type FeatureFlag = {
  tracker: 'v1' | 'v2'
}
let ff: FeatureFlag = {
  tracker: 'v2'
}

class FeatureFlags {
  all (): FeatureFlag {
    return ff
  }
  get (flag: string): string {
    return ff[flag]
  }
  set (flag: string, value: string): string {
    return ff[flag] = value
  }
}

export default new FeatureFlags()
