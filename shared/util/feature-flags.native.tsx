import {featureFlagsOverride} from '@/local-debug.native'
import type {FeatureFlags} from '@/util/feature-flags.shared'
const features = featureFlagsOverride.split(',')

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: __DEV__,
}

// load overrides
Object.keys(ff).forEach(_k => {
  const k = _k as keyof FeatureFlags
  ff[k] = featureOn(k) || ff[k] || false
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
