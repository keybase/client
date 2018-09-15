// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  avatarUploadsEnabled: true,
  explodingMessagesEnabled: true,
  plansEnabled: false,
  walletsEnabled: __DEV__,
  newTeamBuildingForChat: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
