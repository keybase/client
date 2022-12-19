import {featureFlagsOverride} from '../local-debug.desktop'
import type {FeatureFlags} from './feature-flags'

const features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
