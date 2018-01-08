// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  plansEnabled: false,
  tabPeopleEnabled: false,
  teamChatEnabled: true,
  tabGitEnabled: true,
  impTeamChatEnabled: true,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
