// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  fsEnabled: __DEV__,
  impTeamChatEnabled: true,
  newPeopleTab: true,
  plansEnabled: false,
  tabGitEnabled: true,
  tabPeopleEnabled: false,
  teamChatEnabled: true,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
