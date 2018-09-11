// @flow
import type {FeatureFlags} from '../util/feature-flags.js.flow'

const ff: FeatureFlags = {
  admin: false,
  avatarUploadsEnabled: true,
  explodingMessagesEnabled: true,
  fsWritesEnabled: true,
  plansEnabled: false,
  walletsEnabled: true,
  newTeamBuildingForChat: false,
}

console.warn('feature flag mock in effect')

export default ff
