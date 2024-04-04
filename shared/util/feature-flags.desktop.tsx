import {featureFlagsOverride} from '@/local-debug.desktop'
import type {FeatureFlags} from './feature-flags'

const features = featureFlagsOverride?.split(',') || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  archive: true,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {}

// load overrides
Object.keys(ff).forEach(_k => {
  const k = _k as keyof FeatureFlags
  ff[k] = featureOn(k) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
