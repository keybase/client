import {featureFlagsOverride} from '@/local-debug'

type FeatureFlags = {
  admin: boolean
}

const features = (featureFlagsOverride as string | undefined)?.split(',') ?? []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: isMobile ? __DEV__ : false,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {}

// load overrides
Object.keys(ff).forEach(_k => {
  const k = _k as keyof FeatureFlags
  ff[k] = featureOn(k) || ff[k] || (!isMobile && featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
