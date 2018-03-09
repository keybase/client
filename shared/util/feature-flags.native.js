// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  deleteChatHistory: true,
  fsEnabled: __DEV__,
  impTeamChatEnabled: true,
  plansEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
