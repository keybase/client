// @flow
import type {FeatureFlags} from '../util/feature-flags.js.flow'

const ff: FeatureFlags = {
  admin: false,
  avatarUploadsEnabled: true,
  explodingMessagesEnabled: true,
  plansEnabled: false,
  walletsEnabled: true,
}

console.warn('feature flag mock in effect')

export default ff
