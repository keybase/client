// @flow

import type {FeatureFlags} from '../util/feature-flags.js.flow'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  avatarUploadsEnabled: true,
  explodingMessagesEnabled: true,
  plansEnabled: false,
  walletsEnabled: true,
}

console.warn('feature flag mock in effect')

export default ff
